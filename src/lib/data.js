import "server-only";
import { kv } from "@/lib/kv";
import { BASE_DRINK_ITEM_GROUPS } from "@/lib/drinkItems";
import {
  STARTER_SEMESTER,
  STARTER_EVENTS,
  STARTER_GAME_DAYS,
  STARTER_CONTACTS,
  STARTER_CATEGORIES,
  DEFAULT_DRINK_PRESETS,
} from "@/lib/seed";

const SEMESTERS_KEY = "semesters";
const DRINK_PRESETS_KEY = "drinkPresets";
const CUSTOM_DRINK_ITEMS_KEY = "customDrinkItems";
const CATEGORIES_KEY = "categories";
const eventsKey = (semesterId) => `events:${semesterId}`;
const gameDaysKey = (semesterId) => `gamedays:${semesterId}`;
const contactsKey = (semesterId) => `contacts:${semesterId}`;
// One global list, not partitioned per semester — see
// EquipmentItem.purchasedSemesterId for how cost still attributes to a
// specific semester's budget.
const EQUIPMENT_KEY = "equipment";

// Set once ensureSeeded() has confirmed (and, if needed, performed) seeding
// on this warm instance, so later requests on the same instance skip the
// backfill-check reads instead of re-probing Redis every request forever.
let seeded = false;

// Every page load calls ensureSeeded() -> getSemesters(), which is otherwise
// a full Redis round trip for a value that changes maybe once a semester.
// This in-process cache turns repeat reads on a warm instance into memory
// hits; the short TTL bounds staleness across instances/restarts, and writes
// invalidate their key immediately so same-instance reads never see stale
// data.
const CACHE_TTL_MS = 60_000;
const cache = new Map();

async function cached(key, fetcher) {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  const value = await fetcher();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

function invalidateCache(key) {
  cache.delete(key);
}

export async function getSemesters() {
  return cached(SEMESTERS_KEY, async () => (await kv.get(SEMESTERS_KEY)) ?? []);
}

export async function getSemester(id) {
  const semesters = await getSemesters();
  return semesters.find((s) => s.id === id);
}

export async function saveSemester(semester) {
  const semesters = await getSemesters();
  const index = semesters.findIndex((s) => s.id === semester.id);
  if (index === -1) {
    semesters.push(semester);
  } else {
    semesters[index] = semester;
  }
  await kv.set(SEMESTERS_KEY, semesters);
  invalidateCache(SEMESTERS_KEY);
}

export async function getEvents(semesterId) {
  return (await kv.get(eventsKey(semesterId))) ?? [];
}

export async function saveEvent(event) {
  const events = await getEvents(event.semesterId);
  const index = events.findIndex((e) => e.id === event.id);
  if (index === -1) {
    events.push(event);
  } else {
    events[index] = event;
  }
  await kv.set(eventsKey(event.semesterId), events);
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

export async function getGameDays(
  semesterId,
) {
  return (await kv.get(gameDaysKey(semesterId))) ?? [];
}

export async function saveGameDays(
  semesterId,
  gameDays,
) {
  await kv.set(gameDaysKey(semesterId), gameDays);
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
  return cached(DRINK_PRESETS_KEY, async () => (await kv.get(DRINK_PRESETS_KEY)) ?? {});
}

export async function saveDrinkPresets(presets) {
  await kv.set(DRINK_PRESETS_KEY, presets);
  invalidateCache(DRINK_PRESETS_KEY);
}

export async function getCustomDrinkItems() {
  return cached(CUSTOM_DRINK_ITEMS_KEY, async () => (await kv.get(CUSTOM_DRINK_ITEMS_KEY)) ?? []);
}

export async function saveCustomDrinkItems(items) {
  await kv.set(CUSTOM_DRINK_ITEMS_KEY, items);
  invalidateCache(CUSTOM_DRINK_ITEMS_KEY);
}

export function mergeDrinkItemGroups(custom) {
  return BASE_DRINK_ITEM_GROUPS.map((group) => ({
    ...group,
    items: [
      ...group.items,
      ...custom
        .filter((item) => item.group === group.label)
        .map(({ name, price }) => ({ name, price })),
    ],
  }));
}

export async function getDrinkItemGroups() {
  const custom = await getCustomDrinkItems();
  return mergeDrinkItemGroups(custom);
}

export async function addCustomDrinkItem(item) {
  const custom = await getCustomDrinkItems();
  custom.push(item);
  await saveCustomDrinkItems(custom);
}

export async function getEquipmentItems() {
  return (await kv.get(EQUIPMENT_KEY)) ?? [];
}

export async function saveEquipmentItem(item) {
  const items = await getEquipmentItems();
  const index = items.findIndex((i) => i.id === item.id);
  if (index === -1) {
    items.push(item);
  } else {
    items[index] = item;
  }
  await kv.set(EQUIPMENT_KEY, items);
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
  return cached(CATEGORIES_KEY, async () => (await kv.get(CATEGORIES_KEY)) ?? []);
}

export async function saveCategories(categories) {
  await kv.set(CATEGORIES_KEY, categories);
  invalidateCache(CATEGORIES_KEY);
}

// Bundles every read the calendar page needs into a single pipelined Redis
// request (one HTTP round trip) instead of ~7+ separate ones. `semesterIds`
// is every known semester, used to build the cross-semester event list for
// budget stats; it deliberately includes `semesterId` again so the shape
// stays a simple positional destructure, at the cost of that one key being
// fetched twice within the same round trip.
export async function getCalendarPageData(
  semesterId,
  semesterIds,
) {
  const pipeline = kv.pipeline();
  pipeline.get(eventsKey(semesterId));
  pipeline.get(gameDaysKey(semesterId));
  pipeline.get(DRINK_PRESETS_KEY);
  pipeline.get(CUSTOM_DRINK_ITEMS_KEY);
  pipeline.get(EQUIPMENT_KEY);
  pipeline.get(CATEGORIES_KEY);
  for (const id of semesterIds) {
    pipeline.get(eventsKey(id));
  }

  const [events, gameDays, drinkPresets, customItems, equipmentItems, categories, ...perSemesterEvents] =
    await pipeline.exec();

  return {
    events: events ?? [],
    gameDays: gameDays ?? [],
    allEvents: perSemesterEvents.flatMap((e) => e ?? []),
    drinkPresets: drinkPresets ?? {},
    drinkItemGroups: mergeDrinkItemGroups(customItems ?? []),
    equipmentItems: equipmentItems ?? [],
    categories: categories ?? [],
  };
}

// Seeds a starter semester (with example events/game days/contacts and a
// starter category set) on first run only — skips if any semester already
// exists. Also returns the semester list, since every caller needs it right
// after and would otherwise re-fetch the same key. Once this has run once on
// a warm instance, later calls skip the backfill-check reads entirely
// (they're a one-time migration, not a per-request concern).
export async function ensureSeeded() {
  const semesters = await getSemesters();
  if (seeded) return semesters;

  if (semesters.length === 0) {
    await kv.set(SEMESTERS_KEY, [STARTER_SEMESTER]);
    invalidateCache(SEMESTERS_KEY);
    await kv.set(eventsKey(STARTER_SEMESTER.id), STARTER_EVENTS);
    await kv.set(gameDaysKey(STARTER_SEMESTER.id), STARTER_GAME_DAYS);
    await kv.set(contactsKey(STARTER_SEMESTER.id), STARTER_CONTACTS);
    await kv.set(CATEGORIES_KEY, STARTER_CATEGORIES);
    await kv.set(DRINK_PRESETS_KEY, DEFAULT_DRINK_PRESETS);
    seeded = true;
    return [STARTER_SEMESTER];
  }

  // Categories and drink presets backfill independently, in case a semester
  // was created (e.g. by hand or from an older version) before they existed.
  if ((await kv.get(CATEGORIES_KEY)) === null) {
    await kv.set(CATEGORIES_KEY, STARTER_CATEGORIES);
    invalidateCache(CATEGORIES_KEY);
  }

  if ((await kv.get(DRINK_PRESETS_KEY)) === null) {
    await kv.set(DRINK_PRESETS_KEY, DEFAULT_DRINK_PRESETS);
    invalidateCache(DRINK_PRESETS_KEY);
  }

  seeded = true;
  return semesters;
}
