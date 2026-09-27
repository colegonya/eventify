// Every Redis key the app's data lives under. Imported with relative paths
// (no "@/" alias), because scripts/migrate.mjs loads this through plain Node.
//
// Each collection is a hash: one field per record, keyed by the record's id,
// holding that record's JSON. A save writes one field and a delete removes
// one, so two officers saving different records never overwrite each other.
// The v2: prefix is there because Redis can't turn a string key into a hash
// in place, and keeping the old keys untouched is what makes them a backup
// until they're deleted (see migrate.js).

export const KEYS = {
  semesters: "v2:semesters",
  categories: "v2:categories",
  equipment: "v2:equipment",
  drinkGroups: "v2:drinkGroups",
  drinkItems: "v2:drinkItems",
  // Field: category id. Value: { [itemId]: quantity }.
  drinkPresets: "v2:drinkPresets",
  events: (semesterId) => `v2:events:${semesterId}`,
  markers: (semesterId) => `v2:markers:${semesterId}`,
  contacts: (semesterId) => `v2:contacts:${semesterId}`,

  // Single values, unchanged by the move to hashes.
  branding: "branding",
  onboardingDismissed: "onboardingChecklistDismissed",

  // 2 once the data is in the hashes above. Absent on a deployment that
  // predates them, and on a brand-new one.
  schemaVersion: "schemaVersion",
  // When this deployment reached version 2 (ms since epoch). The old keys
  // are deleted a week after it.
  migratedAt: "v2:migratedAt",
  // Which conversions have run, so each runs exactly once. See migrate.js.
  migrated: "v2:migrated",
};

// Where each collection lived before: a string holding a JSON array (or, for
// drink presets, one object).
export const LEGACY_KEYS = {
  semesters: "semesters",
  categories: "categories",
  equipment: "equipment",
  drinkGroups: "drinkGroups",
  drinkPresets: "drinkPresets",
  // Superseded by drinkGroups long before the move to hashes.
  customDrinkItems: "customDrinkItems",
  events: (semesterId) => `events:${semesterId}`,
  markers: (semesterId) => `gamedays:${semesterId}`,
  contacts: (semesterId) => `contacts:${semesterId}`,
};

// The per-semester legacy keys, as SCAN patterns for the cleanup.
export const LEGACY_PATTERNS = ["events:*", "gamedays:*", "contacts:*"];
