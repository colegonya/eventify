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
import {
  STARTER_SEMESTER,
  STARTER_EVENTS,
  STARTER_MARKERS,
  STARTER_CONTACTS,
  STARTER_CATEGORIES,
  DEFAULT_DRINK_GROUPS,
  DEFAULT_DRINK_PRESETS,
} from "@/lib/seed";

const SEMESTERS_KEY = "semesters";
const DRINK_PRESETS_KEY = "drinkPresets";
const DRINK_GROUPS_KEY = "drinkGroups";
// Legacy key, superseded by DRINK_GROUPS_KEY. Read once by the migration in
// ensureDefaults(), then left orphaned in Redis as a rollback safety net.
const CUSTOM_DRINK_ITEMS_KEY = "customDrinkItems";
const CATEGORIES_KEY = "categories";
const BRANDING_KEY = "branding";
const ONBOARDING_KEY = "onboardingChecklistDismissed";
const eventsKey = (semesterId) => `events:${semesterId}`;
const gameDaysKey = (semesterId) => `gamedays:${semesterId}`;
const contactsKey = (semesterId) => `contacts:${semesterId}`;
// One global list, not partitioned per semester — see
// EquipmentItem.purchasedSemesterId for how cost still attributes to a
// specific semester's budget.
const EQUIPMENT_KEY = "equipment";

// Set once ensureDefaults() has confirmed (and, if needed, performed) the
// default backfill on this warm instance, so later requests on the same
// instance skip those reads instead of re-probing Redis every request forever.
let seeded = false;

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
//   - Saves read the list they're about to rewrite straight from Redis, never
//     through the shared read, so a second save in the same request builds
//     on the first instead of on a copy from before it.

const SHARED_KEYS = [
  SEMESTERS_KEY,
  BRANDING_KEY,
  ONBOARDING_KEY,
  CATEGORIES_KEY,
  DRINK_PRESETS_KEY,
  DRINK_GROUPS_KEY,
];

const getSharedData = cache(async () => {
  const [semesters, branding, onboardingDismissed, categories, drinkPresets, drinkGroups] = await kv.mget(
    ...SHARED_KEYS,
  );
  return {
    semesters: semesters ?? [],
    branding: branding ?? {},
    onboardingDismissed: onboardingDismissed ?? false,
    categories: categories ?? [],
    drinkPresets: drinkPresets ?? {},
    drinkGroups: drinkGroups ?? [],
  };
});

export async function getSemesters() {
  return (await getSharedData()).semesters;
}

export async function getSemester(id) {
  const semesters = await getSemesters();
  return semesters.find((s) => s.id === id);
}

/** `list` with `record` replacing the entry that has its id, or added at the end. */
function upsertById(list, record) {
  return list.some((item) => item.id === record.id)
    ? list.map((item) => (item.id === record.id ? record : item))
    : [...list, record];
}

export async function saveSemester(semester) {
  const semesters = (await kv.get(SEMESTERS_KEY)) ?? [];
  await kv.set(SEMESTERS_KEY, upsertById(semesters, semester));
}

// Removes `id` from the semesters list in one atomic Redis-side operation,
// refusing (without writing) if that would leave the list empty.
//
// This is the one place in the app that genuinely needs a Lua script instead
// of the read-then-write pattern used everywhere else: a plain "read the
// list, check the length, write the filtered list" has a real race between
// the read and the write. Two officers deleting two *different* semesters at
// nearly the same moment can each read the same 2-item list before either
// write lands, each compute a valid-looking 1-item remainder, and both
// proceed — verified live while building this fix (a JS-level fresh-read
// re-check narrowed the window but did not close it; two backgrounded curl
// requests reproduced both semesters' events/markers/contacts being wiped
// while the semester list itself still showed one "surviving" entry with no
// data underneath). A single EVAL runs atomically against Redis — no other
// command can interleave with it — so it's the only way to make the guard
// and the write indivisible without a much larger storage-model change.
const DELETE_SEMESTER_SCRIPT = `
local raw = redis.call('GET', KEYS[1])
local semesters = raw and cjson.decode(raw) or {}
local remaining = {}
for _, s in ipairs(semesters) do
  if s.id ~= ARGV[1] then
    table.insert(remaining, s)
  end
end
if #remaining == 0 then
  return 0
end
redis.call('SET', KEYS[1], cjson.encode(remaining))
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
  const removed = await kv.eval(DELETE_SEMESTER_SCRIPT, [SEMESTERS_KEY], [id]);
  if (!removed) {
    throw new Error("Cannot delete the only remaining semester.");
  }
  await kv.del(eventsKey(id), gameDaysKey(id), contactsKey(id));

  const equipment = await getEquipmentItems();
  const orphaned = equipment.filter((item) => item.purchasedSemesterId === id);
  if (orphaned.length > 0) {
    await kv.set(
      EQUIPMENT_KEY,
      equipment.map((item) =>
        item.purchasedSemesterId === id ? { ...item, purchasedSemesterId: null } : item,
      ),
    );
  }
}

export async function getEvents(semesterId) {
  return (await kv.get(eventsKey(semesterId))) ?? [];
}

export async function saveEvent(event) {
  await kv.set(eventsKey(event.semesterId), upsertById(await getEvents(event.semesterId), event));
}

export async function deleteEvent(
  semesterId,
  eventId,
) {
  const events = await getEvents(semesterId);
  await kv.set(
    eventsKey(semesterId),
    events.filter((e) => e.id !== eventId),
  );
}

// The Redis key still says gamedays. It holds the same records under a more
// honest name, and renaming the key would mean migrating live data for nothing
// a user can see — the same call made for "semester" in the other keys.
export async function getMarkers(semesterId) {
  return normalizeMarkers(await kv.get(gameDaysKey(semesterId)));
}

export async function saveMarkers(semesterId, markers) {
  await kv.set(gameDaysKey(semesterId), markers);
}

export async function getContacts(semesterId) {
  return (await kv.get(contactsKey(semesterId))) ?? [];
}

export async function saveContacts(
  semesterId,
  contacts,
) {
  await kv.set(contactsKey(semesterId), contacts);
}

export async function getDrinkPresets() {
  return (await getSharedData()).drinkPresets;
}

export async function saveDrinkPresets(presets) {
  await kv.set(DRINK_PRESETS_KEY, presets);
}

export async function getDrinkGroups() {
  return (await getSharedData()).drinkGroups;
}

export async function saveDrinkGroups(groups) {
  await kv.set(DRINK_GROUPS_KEY, groups);
}

export async function addDrinkItemToGroup(groupId, item) {
  const groups = (await kv.get(DRINK_GROUPS_KEY)) ?? [];
  if (!groups.some((g) => g.id === groupId)) return;
  await saveDrinkGroups(groups.map((g) => (g.id === groupId ? { ...g, items: [...g.items, item] } : g)));
}

export async function getEquipmentItems() {
  return (await kv.get(EQUIPMENT_KEY)) ?? [];
}

export async function saveEquipmentItem(item) {
  await kv.set(EQUIPMENT_KEY, upsertById(await getEquipmentItems(), item));
}

export async function deleteEquipmentItem(id) {
  const items = await getEquipmentItems();
  await kv.set(
    EQUIPMENT_KEY,
    items.filter((i) => i.id !== id),
  );
}

// Categories are chapter-owned data (see types/category.ts) — global, like
// equipment, since a category is a stable kind-of-event that applies across
// semesters, not something that resets each term.
export async function getCategories() {
  return (await getSharedData()).categories;
}

export async function saveCategories(categories) {
  await kv.set(CATEGORIES_KEY, categories);
}

// Bundles the reads the calendar grid needs on every visit into a single
// pipelined Redis request: this semester's events/game days, plus categories
// for the Legend. Deliberately excludes drink presets/groups, equipment, and
// other semesters' event history — those only feed the closed-by-default
// event editor and are fetched on demand by getEditorSupportingData() once it
// actually opens.
export async function getCalendarGridData(semesterId) {
  const pipeline = kv.pipeline();
  pipeline.get(eventsKey(semesterId));
  pipeline.get(gameDaysKey(semesterId));
  pipeline.get(CATEGORIES_KEY);

  const [events, markers, categories] = await pipeline.exec();

  return {
    events: events ?? [],
    // Normalized here rather than at the render site so a pre-existing record
    // written as {opponent} reaches the calendar already looking current.
    markers: normalizeMarkers(markers),
    categories: categories ?? [],
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
  const pipeline = kv.pipeline();
  pipeline.get(DRINK_PRESETS_KEY);
  pipeline.get(DRINK_GROUPS_KEY);
  pipeline.get(EQUIPMENT_KEY);
  for (const id of semesterIds) {
    pipeline.get(eventsKey(id));
  }

  const [drinkPresets, drinkGroups, equipmentItems, ...perSemesterEvents] =
    await pipeline.exec();

  return {
    allEvents: perSemesterEvents.flatMap((e) => e ?? []),
    drinkPresets: drinkPresets ?? {},
    drinkItemGroups: drinkGroups ?? [],
    equipmentItems: equipmentItems ?? [],
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
    let changed = false;
    const updated = events.map((event) => {
      if (normalize(event.host) !== normalize(previousName)) return event;
      changed = true;
      return { ...event, host: chapterName };
    });
    if (changed) await kv.set(eventsKey(semester.id), updated);
  }
}

export async function saveBrandingSettings({ chapterName, colors, orgNoun, periodNoun, appTitle: title, timeZone }) {
  await kv.set(BRANDING_KEY, { chapterName, colors, orgNoun, periodNoun, appTitle: title, timeZone });
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
  await kv.set(ONBOARDING_KEY, true);
}

// Merges the legacy customDrinkItems list into the seeded groups, matching by
// group label the way the old merge did. A custom item whose label matches no
// seeded group gets its own new group appended, so nothing is dropped. Custom
// items already carry UUID ids from when they were created — reuse them so
// any name-keyed presets migrated in the same pass stay attached.
function buildInitialDrinkGroups(customItems) {
  const groups = DEFAULT_DRINK_GROUPS.map((group) => ({
    ...group,
    items: group.items.map((item) => ({ ...item })),
  }));
  for (const custom of customItems) {
    const item = {
      id: custom.id ?? crypto.randomUUID(),
      name: custom.name,
      price: custom.price,
    };
    const group = groups.find((g) => g.label === custom.group);
    if (group) {
      group.items.push(item);
    } else {
      groups.push({ id: crypto.randomUUID(), label: custom.group, items: [item] });
    }
  }
  return groups;
}

// Backfills the defaults the app can't function without — an event has to pick
// a category from somewhere, and the Drinks tab needs a catalog and presets to
// autofill from. Deliberately does NOT create a semester: a deployment with no
// semesters is one that hasn't been through /setup yet, and inventing a
// fictional semester there is what used to leave new chapters stuck with a
// hardcoded "Example Semester" they couldn't rename. Returns the semester list
// since every caller needs it right after. Once this has run on a warm
// instance later calls skip the backfill reads entirely.
export async function ensureDefaults() {
  const semesters = await getSemesters();
  if (seeded) return semesters;

  if ((await kv.get(CATEGORIES_KEY)) === null) {
    await kv.set(CATEGORIES_KEY, STARTER_CATEGORIES);
  }

  // Materializes the drinkGroups catalog: seeded defaults merged with any
  // legacy customDrinkItems (pre-Drinks-tab deployments), and in the same
  // pass re-keys existing drinkPresets from item names to item ids. Must run
  // BEFORE the presets seed below — a fresh deploy has to seed the id-keyed
  // DEFAULT_DRINK_PRESETS, and a legacy deploy has to migrate its name-keyed
  // presets before the null-check would skip them. The NX write matters: two
  // cold instances can both see drinkGroups === null, and if the loser re-ran
  // the name→id re-key against presets the winner already migrated, it would
  // find zero name matches and wipe every preset. Only the instance whose
  // SET NX landed does the re-key; keys that already look like item ids are
  // kept as a further idempotence guard.
  if ((await kv.get(DRINK_GROUPS_KEY)) === null) {
    const customItems = (await kv.get(CUSTOM_DRINK_ITEMS_KEY)) ?? [];
    const groups = buildInitialDrinkGroups(customItems);
    const wasSet = await kv.set(DRINK_GROUPS_KEY, groups, { nx: true });

    if (wasSet) {
      const presets = await kv.get(DRINK_PRESETS_KEY);
      if (presets !== null) {
        const items = groups.flatMap((g) => g.items);
        const idByName = new Map(items.map((item) => [item.name, item.id]));
        const knownIds = new Set(items.map((item) => item.id));
        const migrated = {};
        for (const [categoryId, quantities] of Object.entries(presets)) {
          const migratedQuantities = {};
          for (const [key, qty] of Object.entries(quantities)) {
            const itemId = knownIds.has(key) ? key : idByName.get(key);
            if (itemId) migratedQuantities[itemId] = qty;
          }
          if (Object.keys(migratedQuantities).length > 0) {
            migrated[categoryId] = migratedQuantities;
          }
        }
        await kv.set(DRINK_PRESETS_KEY, migrated);
      }
    }
  }

  if ((await kv.get(DRINK_PRESETS_KEY)) === null) {
    await kv.set(DRINK_PRESETS_KEY, DEFAULT_DRINK_PRESETS);
  }

  seeded = true;
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
  const contacts = STARTER_CONTACTS.map((c) => ({
    ...c,
    semesterId: semester.id,
    meetingDate: c.meetingDate ? shift(c.meetingDate) : null,
  }));

  await Promise.all([
    kv.set(eventsKey(semester.id), events),
    kv.set(gameDaysKey(semester.id), markers),
    kv.set(contactsKey(semester.id), contacts),
  ]);
}
