// What the storage upgrade writes, worked out from what's stored under the
// old keys. Kept apart from migrate.js, which does the Redis I/O, so this
// part is unit tested and measured. Relative imports only: scripts/migrate.mjs
// loads it through plain Node.

import { KEYS, LEGACY_KEYS } from "./keys.js";
import { splitDrinkGroups } from "./records.js";

const asList = (value) => (Array.isArray(value) ? value : []);

/** Old records all have ids; this only guards against one that somehow doesn't. */
const withId = (record) => (record?.id ? record : { ...record, id: crypto.randomUUID() });

const indexed = (list) => asList(list).map((record, sortOrder) => ({ ...withId(record), sortOrder }));

// The name→id re-key for drink presets saved before items had ids. Only
// reachable on a deployment old enough to have no drinkGroups key at all.
function rekeyPresets(presets, groups) {
  const items = groups.flatMap((g) => g.items);
  const idByName = new Map(items.map((item) => [item.name, item.id]));
  const knownIds = new Set(items.map((item) => item.id));
  const migrated = {};
  for (const [categoryId, quantities] of Object.entries(presets ?? {})) {
    const out = {};
    for (const [key, qty] of Object.entries(quantities ?? {})) {
      const itemId = knownIds.has(key) ? key : idByName.get(key);
      if (itemId) out[itemId] = qty;
    }
    if (Object.keys(out).length > 0) migrated[categoryId] = out;
  }
  return migrated;
}

// Folds the even older customDrinkItems list into the default groups by
// group label; an item whose group matches none gets a group of its own.
function initialDrinkGroups(defaultGroups, customItems) {
  const groups = defaultGroups.map((g) => ({ ...g, items: g.items.map((item) => ({ ...item })) }));
  for (const custom of asList(customItems)) {
    const item = { id: custom.id ?? crypto.randomUUID(), name: custom.name, price: custom.price };
    const group = groups.find((g) => g.label === custom.group);
    if (group) group.items.push(item);
    else groups.push({ id: crypto.randomUUID(), label: custom.group, items: [item] });
  }
  return groups;
}

/**
 * What the migration would write, from what's stored under the old keys.
 * Pure, so it's tested without Redis.
 *
 * `legacy` maps each old key name to { digest, value }. `defaults` holds the
 * starter categories, drink groups and drink presets a new deployment gets;
 * without it (the command-line script), a unit that needs one is left for
 * the app to finish.
 *
 * Returns units: { name, guards: { key: digest }, targets: [{ key, records }],
 * legacyCount }, plus `skipped`, the names left for the app.
 */
export function buildPlan(legacy, defaults) {
  const units = [];
  const skipped = [];
  const entry = (key) => legacy[key] ?? { digest: "none", value: null };
  const guardsFor = (...keys) => Object.fromEntries(keys.map((key) => [key, entry(key).digest]));

  const listUnit = (name, legacyKey, targetKey, fallback) => {
    const stored = entry(legacyKey).value;
    const list = stored ?? fallback;
    if (list === undefined) {
      skipped.push(name);
      return;
    }
    units.push({
      name,
      guards: guardsFor(legacyKey),
      targets: [{ key: targetKey, records: indexed(list) }],
      legacyCount: asList(stored).length,
    });
  };

  listUnit("semesters", LEGACY_KEYS.semesters, KEYS.semesters, []);
  // A deployment with no categories key at all gets the starters, as it
  // always has. An empty list that was saved stays empty.
  listUnit("categories", LEGACY_KEYS.categories, KEYS.categories, defaults?.categories);
  listUnit("equipment", LEGACY_KEYS.equipment, KEYS.equipment, []);

  for (const semester of asList(entry(LEGACY_KEYS.semesters).value)) {
    const id = semester?.id;
    if (!id) continue;
    listUnit(`events:${id}`, LEGACY_KEYS.events(id), KEYS.events(id), []);
    listUnit(`markers:${id}`, LEGACY_KEYS.markers(id), KEYS.markers(id), []);
    listUnit(`contacts:${id}`, LEGACY_KEYS.contacts(id), KEYS.contacts(id), []);
  }

  // The catalog and its presets move together: presets point at item ids,
  // and on the oldest deployments those ids are made up during this step.
  const storedGroups = entry(LEGACY_KEYS.drinkGroups).value;
  const storedPresets = entry(LEGACY_KEYS.drinkPresets).value;
  let groups;
  let presets;
  if (storedGroups) {
    groups = asList(storedGroups);
    presets = storedPresets ?? defaults?.drinkPresets;
  } else if (defaults) {
    groups = initialDrinkGroups(defaults.drinkGroups, entry(LEGACY_KEYS.customDrinkItems).value);
    presets = storedPresets ? rekeyPresets(storedPresets, groups) : defaults.drinkPresets;
  }
  if (groups && presets) {
    const { groupRecords, itemRecords } = splitDrinkGroups(groups.map(withId));
    const presetRecords = Object.entries(presets)
      .filter(([, quantities]) => quantities && Object.keys(quantities).length > 0)
      .map(([categoryId, quantities]) => ({ id: categoryId, quantities }));
    units.push({
      name: "drinks",
      guards: guardsFor(LEGACY_KEYS.drinkGroups, LEGACY_KEYS.drinkPresets, LEGACY_KEYS.customDrinkItems),
      targets: [
        { key: KEYS.drinkGroups, records: groupRecords },
        { key: KEYS.drinkItems, records: itemRecords },
        // Stored as the bare quantities object, keyed by category id.
        { key: KEYS.drinkPresets, records: presetRecords, value: (r) => r.quantities },
      ],
      legacyCount: asList(storedGroups).length,
    });
  } else {
    skipped.push("drinks");
  }

  return { units, skipped };
}

