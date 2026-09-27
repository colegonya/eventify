import "server-only";
import { cache } from "react";
import { kv } from "@/lib/kv";
import { parseISODate, formatISODate, isValidTimeZone } from "@/lib/dates";
import {
  DEFAULT_CHAPTER_NAME,
  DEFAULT_BRAND_COLORS,
  BRAND_COLOR_VARS,
  DEFAULT_TIME_ZONE,
  appTitle,
} from "@/lib/config";
import { vocabulary } from "@/lib/vocabulary";
import { normalizeMarkers } from "@/lib/markers";
import { KEYS } from "@/lib/keys";
import { migrateToV2, deleteLegacyKeys, SCHEMA_VERSION } from "@/lib/migrate";
import {
  assembleDrinkGroups,
  byId,
  hashValues,
  inSortOrder,
  withSortOrders,
} from "@/lib/records";
import {
  STARTER_SEMESTER,
  STARTER_EVENTS,
  STARTER_MARKERS,
  STARTER_CONTACTS,
  STARTER_CATEGORIES,
  DEFAULT_DRINK_GROUPS,
  DEFAULT_DRINK_PRESETS,
} from "@/lib/seed";

// Every collection is a Redis hash, one field per record (see keys.js), so a
// save writes only the record it changed. The whole-list read-modify-write
// this replaced lost whichever of two concurrent saves landed first.
const DEFAULTS = {
  categories: STARTER_CATEGORIES,
  drinkGroups: DEFAULT_DRINK_GROUPS,
  drinkPresets: DEFAULT_DRINK_PRESETS,
};

// The move from whole-list keys to hashes, run by the first request each
// server instance handles (see migrate.js for why that's safe with many
// instances at once). After the first check it costs nothing: the promise
// is kept for the life of the instance. A failure isn't kept, so the next
// request tries again. getSharedData also re-checks the version on every
// request, for free, in case the data was rolled back underneath a running
// instance (scripts/migrate.mjs --rollback, or a test emptying Redis).
let migration = null;
function ensureMigrated() {
  migration ??= migrateToV2(kv, { defaults: DEFAULTS }).catch((error) => {
    migration = null;
    throw error;
  });
  return migration;
}

// Checked once per instance: deletes the old keys a week after the upgrade.
// Production only. A preview deployment can share production's database
// while production still runs the release before the upgrade and reads the
// old keys, so a preview opened a week later must never delete them.
let legacyChecked = process.env.VERCEL_ENV !== "production";

// Every read goes to Redis; nothing is kept between requests. This used to
// hold a 60-second copy per server instance, which showed an officer their
// own saved change "reverting" whenever the next request landed on another
// instance, and kept a failed write on screen as if it had saved.
//
// What keeps that from costing speed:
//   - The small, chapter-wide values almost every page needs come back in one
//     pipelined request (getSharedData below).
//   - React's cache() shares a read across one request, so the layout, the
//     page, and generateMetadata asking for branding make one request, not
//     three. It's scoped to a single render, so it can't go stale.
//   - Saves never edit the objects a read returned. They build new ones, so a
//     value shared within a render can't change under another reader.

async function readShared() {
  const pipeline = kv.pipeline();
  pipeline.get(KEYS.schemaVersion);
  pipeline.hgetall(KEYS.semesters);
  pipeline.get(KEYS.branding);
  pipeline.get(KEYS.onboardingDismissed);
  pipeline.hgetall(KEYS.categories);
  pipeline.hgetall(KEYS.drinkPresets);
  pipeline.hgetall(KEYS.drinkGroups);
  pipeline.hgetall(KEYS.drinkItems);
  return pipeline.exec();
}

const getSharedData = cache(async () => {
  await ensureMigrated();
  let results = await readShared();
  if (Number(results[0]) < SCHEMA_VERSION) {
    migration = null;
    await ensureMigrated();
    results = await readShared();
  }
  const [, semesters, branding, onboardingDismissed, categories, drinkPresets, drinkGroups, drinkItems] = results;
  return {
    semesters: inSortOrder(semesters),
    branding: branding ?? {},
    onboardingDismissed: onboardingDismissed ?? false,
    categories: inSortOrder(categories),
    drinkPresets: drinkPresets ?? {},
    drinkGroups: assembleDrinkGroups(drinkGroups, drinkItems),
  };
});

/**
 * Writes one record. An existing record keeps its place in the list; a new
 * one goes last. Used where one form saves one record, so there's no list of
 * sort orders to work from.
 */
async function saveOne(key, record) {
  await ensureMigrated();
  const stored = await kv.hget(key, record.id);
  const sortOrder = record.sortOrder ?? stored?.sortOrder ?? Date.now();
  await kv.hset(key, { [record.id]: { ...record, sortOrder } });
}

/**
 * Applies a list editor's changes in one transaction: `upserts` are the rows
 * it changed or added (sort orders already set), `deletedIds` the rows it
 * removed. Rows nobody touched aren't written, so another officer's edit to
 * one of them survives.
 */
async function applyChanges(key, upserts, deletedIds) {
  await ensureMigrated();
  if (upserts.length === 0 && deletedIds.length === 0) return;
  const tx = kv.multi();
  if (upserts.length > 0) tx.hset(key, byId(upserts));
  if (deletedIds.length > 0) tx.hdel(key, ...deletedIds);
  await tx.exec();
}

async function readHash(key) {
  await ensureMigrated();
  return kv.hgetall(key);
}

export async function getSemesters() {
  return (await getSharedData()).semesters;
}

export async function getSemester(id) {
  const semesters = await getSemesters();
  return semesters.find((s) => s.id === id);
}

export async function saveSemester(semester) {
  await saveOne(KEYS.semesters, semester);
}

// Removes `id` from the semesters hash, refusing (without writing) if that
// would leave none. One Lua script, so the check and the delete can't be
// split: two officers deleting two *different* semesters at nearly the same
// moment could otherwise each see two, each delete one, and leave none —
// verified live on the list layout this replaced, where it wiped both
// semesters' events, markers and contacts.
const DELETE_SEMESTER_SCRIPT = `
local exists = redis.call('HEXISTS', KEYS[1], ARGV[1])
if redis.call('HLEN', KEYS[1]) - exists == 0 then
  return 0
end
redis.call('HDEL', KEYS[1], ARGV[1])
return 1
`;

// Drops the semester and everything scoped to it. Equipment is global, not
// scoped, so it isn't deleted — but an item purchased during this semester
// has its purchasedSemesterId reset to null (back to an unattributed wishlist
// item, visible on every semester again) rather than left pointing at a
// semester id that no longer exists. equipmentItemsForSemester only matches
// an item to a semester whose id it equals exactly, so a stale id there
// isn't "harmlessly ignored" — it makes the item, and its real cost, vanish
// from every remaining semester's budget with no way to reach it again.
export async function deleteSemester(id) {
  await ensureMigrated();
  const removed = await kv.eval(DELETE_SEMESTER_SCRIPT, [KEYS.semesters], [id]);
  if (!removed) {
    throw new Error("Cannot delete the only remaining semester.");
  }
  await kv.del(KEYS.events(id), KEYS.markers(id), KEYS.contacts(id));

  const orphaned = (await getEquipmentItems()).filter((item) => item.purchasedSemesterId === id);
  if (orphaned.length > 0) {
    await kv.hset(
      KEYS.equipment,
      byId(orphaned.map((item) => ({ ...item, purchasedSemesterId: null }))),
    );
  }
}

export async function getEvents(semesterId) {
  return hashValues(await readHash(KEYS.events(semesterId)));
}

export async function saveEvent(event) {
  await ensureMigrated();
  await kv.hset(KEYS.events(event.semesterId), { [event.id]: event });
}

export async function deleteEvent(semesterId, eventId) {
  await ensureMigrated();
  await kv.hdel(KEYS.events(semesterId), eventId);
}

// Still stored under the old "gamedays" name until this move to hashes; see
// markers.js for the record shape.
export async function getMarkers(semesterId) {
  return normalizeMarkers(hashValues(await readHash(KEYS.markers(semesterId))));
}

export async function saveMarkerChanges(semesterId, upserts, deletedIds) {
  await applyChanges(KEYS.markers(semesterId), upserts, deletedIds);
}

export async function getContacts(semesterId) {
  return inSortOrder(await readHash(KEYS.contacts(semesterId)));
}

export async function saveContactChanges(semesterId, upserts, deletedIds) {
  await applyChanges(
    KEYS.contacts(semesterId),
    withSortOrders(await getContacts(semesterId), upserts),
    deletedIds,
  );
}

export async function getDrinkPresets() {
  return (await getSharedData()).drinkPresets;
}

/**
 * `presets` maps each category the editor sent to its full set of quantities.
 * A category with none left is deleted rather than stored empty.
 */
export async function saveDrinkPresetChanges(presets) {
  await ensureMigrated();
  const entries = Object.entries(presets);
  const kept = entries.filter(([, quantities]) => Object.keys(quantities).length > 0);
  const emptied = entries.filter(([, quantities]) => Object.keys(quantities).length === 0);
  if (entries.length === 0) return;
  const tx = kv.multi();
  if (kept.length > 0) tx.hset(KEYS.drinkPresets, Object.fromEntries(kept));
  if (emptied.length > 0) tx.hdel(KEYS.drinkPresets, ...emptied.map(([id]) => id));
  await tx.exec();
}

export async function getDrinkGroups() {
  return (await getSharedData()).drinkGroups;
}

/** The stored catalog records, sort orders included, straight from Redis. */
export async function getDrinkCatalogRecords() {
  await ensureMigrated();
  const pipeline = kv.pipeline();
  pipeline.hgetall(KEYS.drinkGroups);
  pipeline.hgetall(KEYS.drinkItems);
  const [groups, items] = await pipeline.exec();
  return { groups: hashValues(groups), items: hashValues(items) };
}

/**
 * The Drinks tab's catalog changes, as one transaction across both hashes.
 * Sort orders are set here: an existing group or item keeps its place, and new
 * ones go last in the order the editor sent them.
 */
export async function saveDrinkCatalogChanges({ groups, items, deletedGroupIds, deletedItemIds }) {
  const stored = await getDrinkCatalogRecords();
  const tx = kv.multi();
  if (groups.length > 0) tx.hset(KEYS.drinkGroups, byId(withSortOrders(stored.groups, groups)));
  if (items.length > 0) tx.hset(KEYS.drinkItems, byId(withSortOrders(stored.items, items)));
  if (deletedGroupIds.length > 0) tx.hdel(KEYS.drinkGroups, ...deletedGroupIds);
  if (deletedItemIds.length > 0) tx.hdel(KEYS.drinkItems, ...deletedItemIds);
  await tx.exec();
}

export async function addDrinkItemToGroup(groupId, item) {
  await ensureMigrated();
  if (!(await kv.hexists(KEYS.drinkGroups, groupId))) return;
  await kv.hset(KEYS.drinkItems, { [item.id]: { ...item, groupId, sortOrder: Date.now() } });
}

export async function getEquipmentItems() {
  return inSortOrder(await readHash(KEYS.equipment));
}

export async function saveEquipmentItem(item) {
  await saveOne(KEYS.equipment, item);
}

export async function deleteEquipmentItem(id) {
  await ensureMigrated();
  await kv.hdel(KEYS.equipment, id);
}

// Categories are chapter-owned data (see types/category.ts) — global, like
// equipment, since a category is a stable kind-of-event that applies across
// semesters, not something that resets each term.
export async function getCategories() {
  return (await getSharedData()).categories;
}

export async function saveCategoryChanges(upserts, deletedIds) {
  await ensureMigrated();
  const stored = inSortOrder(await kv.hgetall(KEYS.categories));
  await applyChanges(KEYS.categories, withSortOrders(stored, upserts), deletedIds);
}

// Bundles the reads the calendar grid needs on every visit into a single
// pipelined Redis request: this semester's events/markers, plus categories
// for the Legend. Deliberately excludes drink presets/groups, equipment, and
// other semesters' event history — those only feed the closed-by-default
// event editor and are fetched on demand by getEditorSupportingData() once it
// actually opens.
export async function getCalendarGridData(semesterId) {
  await ensureMigrated();
  const pipeline = kv.pipeline();
  pipeline.hgetall(KEYS.events(semesterId));
  pipeline.hgetall(KEYS.markers(semesterId));
  pipeline.hgetall(KEYS.categories);

  const [events, markers, categories] = await pipeline.exec();

  return {
    events: hashValues(events),
    // Normalized here rather than at the render site so a pre-existing record
    // written as {opponent} reaches the calendar already looking current.
    markers: normalizeMarkers(hashValues(markers)),
    categories: inSortOrder(categories),
  };
}

// The event editor's supporting data: drink presets/groups for the drink
// calculator and every semester's event history for categorySpendStats (the
// "typically runs $X" hint). `semesterIds` is every known semester, used to
// build the cross-semester event list; it deliberately includes `semesterId`
// again so the shape stays a simple loop, at the cost of that one key being
// fetched twice within the same round trip. Only called once the editor
// dialog opens, since a semester with many semesters' worth of history would
// otherwise pay this cost on every calendar view for a dialog most visits
// never open.
export async function getEditorSupportingData(
  semesterId,
  semesterIds,
) {
  await ensureMigrated();
  const pipeline = kv.pipeline();
  pipeline.hgetall(KEYS.drinkPresets);
  pipeline.hgetall(KEYS.drinkGroups);
  pipeline.hgetall(KEYS.drinkItems);
  pipeline.hgetall(KEYS.equipment);
  for (const id of semesterIds) {
    pipeline.hgetall(KEYS.events(id));
  }

  const [drinkPresets, drinkGroups, drinkItems, equipmentItems, ...perSemesterEvents] =
    await pipeline.exec();

  return {
    allEvents: perSemesterEvents.flatMap(hashValues),
    drinkPresets: drinkPresets ?? {},
    drinkItemGroups: assembleDrinkGroups(drinkGroups, drinkItems),
    equipmentItems: inSortOrder(equipmentItems),
  };
}

/**
 * The chapter's name and colors, with anything saved on the Settings page
 * layered over the deploy-time env defaults. Falls back per-field rather than
 * wholesale, so a chapter that only sets a name still gets env colors.
 */
export async function getBrandingSettings() {
  const saved = (await getSharedData()).branding;
  const chapterName = saved.chapterName?.trim() || DEFAULT_CHAPTER_NAME;
  const colors = {};
  for (const [, key] of BRAND_COLOR_VARS) {
    colors[key] = saved.colors?.[key] || DEFAULT_BRAND_COLORS[key] || "";
  }
  // What this deployment calls itself and calls a term. Absent on every
  // instance that predates the setting, which is why vocabulary() supplies
  // the fallbacks rather than a migration doing it.
  const words = vocabulary({ orgNoun: saved.orgNoun, periodNoun: saved.periodNoun });
  return {
    chapterName,
    // A blank override means "derive it", so renaming the org keeps the title
    // in step instead of stranding a stale one nobody remembers editing.
    appTitle: saved.appTitle?.trim() || appTitle(chapterName),
    appTitleOverride: saved.appTitle?.trim() ?? "",
    colors,
    words,
    // What "today" means for this organization. See todayInTimeZone.
    timeZone: isValidTimeZone(saved.timeZone) ? saved.timeZone : DEFAULT_TIME_ZONE,
  };
}

/**
 * Rewrites the stored `host` on every event the chapter hosts itself, after the
 * chapter changes its name.
 *
 * An event records its host as a plain string, and conflict detection decides
 * "is this ours?" by comparing that string to the chapter name. Without this,
 * renaming (which nearly every chapter does, since the name starts as a
 * placeholder) would quietly orphan every event created beforehand: still on
 * the calendar, no longer recognized as the chapter's own. Other orgs' events
 * keep their host untouched.
 */
export async function renameChapterInEventHosts(previousName, chapterName) {
  const normalize = (name) => name.trim().toLowerCase();
  if (normalize(previousName) === normalize(chapterName)) return;

  const semesters = await getSemesters();
  for (const semester of semesters) {
    const events = await getEvents(semester.id);
    // Only the events it renames, so an edit to any other lands untouched.
    const updated = events
      .filter((event) => normalize(event.host) === normalize(previousName))
      .map((event) => ({ ...event, host: chapterName }));
    if (updated.length > 0) await kv.hset(KEYS.events(semester.id), byId(updated));
  }
}

export async function saveBrandingSettings({ chapterName, colors, orgNoun, periodNoun, appTitle: title, timeZone }) {
  await kv.set(KEYS.branding, { chapterName, colors, orgNoun, periodNoun, appTitle: title, timeZone });
}

// Whether the "get the most out of your calendar" checklist on the Calendar
// tab has been dismissed. One shared flag for the whole chapter, not
// per-browser — there's no per-user login here, so "dismissed" should mean
// dismissed for everyone, the same way every other setting in this app is
// shared rather than personal. Absent key (a deployment that hasn't touched
// this yet) defaults to false, i.e. still shown — including on chapters that
// finished setup before this existed, since the content is generically
// useful and dismissing it is one click.
export async function isOnboardingChecklistDismissed() {
  return (await getSharedData()).onboardingDismissed;
}

export async function dismissOnboardingChecklist() {
  await kv.set(KEYS.onboardingDismissed, true);
}

// The gate every app page goes through (via requireSemesters). The defaults
// an event and the Drinks tab can't do without (categories, a drink catalog
// and presets) are written by the migration on a brand-new deployment, the
// same way it converts an older one. Deliberately does NOT create a
// semester: a deployment with no semesters is one that hasn't been through
// /setup yet, and inventing a fictional semester there is what used to leave
// new chapters stuck with a hardcoded "Example Semester" they couldn't
// rename. Returns the semester list since every caller needs it right after.
//
// Once per production instance it also deletes the old whole-list keys,
// when the week they're kept as a backup is up. A failure there never blocks
// the page.
export async function ensureDefaults() {
  const semesters = await getSemesters();
  if (!legacyChecked) {
    legacyChecked = true;
    try {
      await deleteLegacyKeys(kv);
    } catch (error) {
      legacyChecked = false;
      console.error("Couldn't delete the old data keys; will retry.", error);
    }
  }
  return semesters;
}

/**
 * Fills a freshly created semester with the example events, game days, and
 * contacts, for a chapter that picked "show me an example" at setup.
 *
 * Each example date's offset from the canned semester's start is scaled by
 * the ratio of the real semester's span to the canned one's (~110 days),
 * then applied to the real semester's start — not just shifted by a fixed
 * number of days. A fixed shift keeps every event's distance-from-start
 * identical, so a chapter with a much shorter term (a 3-week winter rush,
 * say) would get examples scattered for months past their own semester's end
 * date. Scaling keeps every example within the chapter's actual start/end,
 * compressed or stretched to fit, and preserves each event's relative order.
 *
 * `chapterName` is passed in rather than read back: setup saves it moments
 * earlier in the same request, and a read shared across that request could
 * still hold the placeholder.
 */
export async function seedExampleData(semester, chapterName) {
  const starterStart = parseISODate(STARTER_SEMESTER.startDate).getTime();
  const starterSpanMs = parseISODate(STARTER_SEMESTER.endDate).getTime() - starterStart;
  const newStart = parseISODate(semester.startDate).getTime();
  const newSpanMs = parseISODate(semester.endDate).getTime() - newStart;
  const scale = newSpanMs / starterSpanMs;
  const shift = (iso) =>
    formatISODate(new Date(newStart + Math.round((parseISODate(iso).getTime() - starterStart) * scale)));

  const events = STARTER_EVENTS.map((e) => ({
    ...e,
    semesterId: semester.id,
    // Canned events authored as the chapter's own keep that ownership under
    // whatever the chapter is actually called, so conflict detection still
    // recognizes them; another org's example event keeps its own host.
    host: e.host === DEFAULT_CHAPTER_NAME ? chapterName : e.host,
    startDate: shift(e.startDate),
    endDate: shift(e.endDate),
  }));
  const markers = STARTER_MARKERS.map((m) => ({
    ...m,
    semesterId: semester.id,
    date: shift(m.date),
  }));
  const contacts = STARTER_CONTACTS.map((c, sortOrder) => ({
    ...c,
    sortOrder,
    semesterId: semester.id,
    meetingDate: c.meetingDate ? shift(c.meetingDate) : null,
  }));

  await ensureMigrated();
  const tx = kv.multi();
  tx.hset(KEYS.events(semester.id), byId(events));
  tx.hset(KEYS.markers(semester.id), byId(markers));
  tx.hset(KEYS.contacts(semester.id), byId(contacts));
  await tx.exec();
}
