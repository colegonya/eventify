// Moves a deployment's data from the old layout (one string key per list,
// holding the whole list as JSON) to one hash per collection (see keys.js),
// and later deletes the old keys.
//
// The app runs this itself on the first request after the upgrade (see
// ensureMigrated in data.js), because most deployments come from the
// one-click template and nobody there will run a script. scripts/migrate.mjs
// runs the same code by hand: a dry run, a backup, an early cleanup, and a
// rollback.
//
// How it stays safe with several server instances starting at once:
//   - The work is split into units (the semester list, one semester's events,
//     the drink catalog, ...). Each unit is written by one Lua script, which
//     Redis runs without letting any other command in between.
//   - The script first checks the unit's name against the v2:migrated set and
//     does nothing if it's there, so every unit converts exactly once no
//     matter how many instances try. A set is used, not "does the hash exist
//     yet", because deleting a list's last record removes its hash, and a
//     second conversion would then bring the deleted records back.
//   - The records are built here in JavaScript from the old JSON. Redis's own
//     Lua JSON library turns an empty list into {}, which would corrupt every
//     event with no line items. The script also checks that the old key still
//     holds exactly what was read (by SHA-1). If an old deployment wrote to it
//     in between, the unit is re-read and rebuilt.
//
// Relative imports only: scripts/migrate.mjs loads this through plain Node.

import { KEYS, LEGACY_KEYS, LEGACY_PATTERNS } from "./keys.js";
import { buildPlan } from "./migrationPlan.js";
import { assembleDrinkGroups, bySortOrder, hashValues } from "./records.js";

export const SCHEMA_VERSION = 2;
// How long the old keys stay after the upgrade, as a backup.
export const LEGACY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const LEGACY_DELETED_KEY = "v2:legacyDeleted";
// HSET arguments per call, so a long list can't overflow Lua's stack.
const FIELDS_PER_HSET = 200;
const ATTEMPTS = 5;

// Reads keys as [digest, value] pairs. The digest identifies the exact stored
// bytes, which the value (already parsed by the client) can't.
const READ_SCRIPT = `
local out = {}
for _, key in ipairs(KEYS) do
  local raw = redis.call('GET', key)
  if raw then
    out[#out + 1] = 'sha:' .. redis.sha1hex(raw)
    out[#out + 1] = raw
  else
    out[#out + 1] = 'none'
    out[#out + 1] = false
  end
end
return out
`;

// KEYS: the migrated set, then each guard key, then each target hash.
// ARGV: unit name, guard count, each guard's expected digest, then for each
// target its field count followed by field/value pairs.
// Returns 1 when converted, 0 when already done, -1 when an old key changed.
const CONVERT_SCRIPT = `
if redis.call('SISMEMBER', KEYS[1], ARGV[1]) == 1 then return 0 end
local guards = tonumber(ARGV[2])
for i = 1, guards do
  local raw = redis.call('GET', KEYS[1 + i])
  local digest = raw and ('sha:' .. redis.sha1hex(raw)) or 'none'
  if digest ~= ARGV[2 + i] then return -1 end
end
local a = 3 + guards
for k = 2 + guards, #KEYS do
  local n = tonumber(ARGV[a])
  a = a + 1
  local chunk = {}
  for j = 0, 2 * n - 1 do
    chunk[#chunk + 1] = ARGV[a + j]
    if #chunk == ${FIELDS_PER_HSET * 2} then
      redis.call('HSET', KEYS[k], unpack(chunk))
      chunk = {}
    end
  end
  if #chunk > 0 then redis.call('HSET', KEYS[k], unpack(chunk)) end
  a = a + 2 * n
end
redis.call('SADD', KEYS[1], ARGV[1])
return 1
`;

async function readLegacy(redis, keys) {
  const flat = keys.length ? await redis.eval(READ_SCRIPT, keys, []) : [];
  const out = {};
  keys.forEach((key, i) => {
    const raw = flat[2 * i + 1];
    out[key] = { digest: flat[2 * i], value: typeof raw === "string" ? JSON.parse(raw) : raw };
  });
  return out;
}

async function plan(redis, defaults) {
  const top = [
    LEGACY_KEYS.semesters,
    LEGACY_KEYS.categories,
    LEGACY_KEYS.equipment,
    LEGACY_KEYS.drinkGroups,
    LEGACY_KEYS.drinkPresets,
    LEGACY_KEYS.customDrinkItems,
  ];
  const legacy = await readLegacy(redis, top);
  const stored = legacy[LEGACY_KEYS.semesters].value;
  const semesterIds = (Array.isArray(stored) ? stored : [])
    .map((s) => s?.id)
    .filter(Boolean);
  const perSemester = semesterIds.flatMap((id) => [
    LEGACY_KEYS.events(id),
    LEGACY_KEYS.markers(id),
    LEGACY_KEYS.contacts(id),
  ]);
  Object.assign(legacy, await readLegacy(redis, perSemester));
  return buildPlan(legacy, defaults);
}

function convert(redis, unit) {
  const guardKeys = Object.keys(unit.guards);
  const keys = [KEYS.migrated, ...guardKeys, ...unit.targets.map((t) => t.key)];
  const args = [unit.name, String(guardKeys.length), ...guardKeys.map((k) => unit.guards[k])];
  for (const target of unit.targets) {
    args.push(String(target.records.length));
    for (const record of target.records) {
      args.push(record.id, JSON.stringify(target.value ? target.value(record) : record));
    }
  }
  return redis.eval(CONVERT_SCRIPT, keys, args);
}

/**
 * Converts every unit not yet converted, then marks the deployment as on
 * version 2. Safe to run from any number of instances at once, and a no-op
 * once done. Returns what it did.
 */
export async function migrateToV2(redis, { defaults, now = Date.now() } = {}) {
  if (Number(await redis.get(KEYS.schemaVersion)) >= SCHEMA_VERSION) {
    return { alreadyDone: true, converted: [], skipped: [] };
  }

  const converted = [];
  let skipped = [];
  for (let attempt = 1; ; attempt++) {
    const { units, skipped: left } = await plan(redis, defaults);
    skipped = left;
    let changedUnderUs = false;
    for (const unit of units) {
      const result = Number(await convert(redis, unit));
      if (result === 1) converted.push(unit.name);
      if (result === -1) changedUnderUs = true;
    }
    if (!changedUnderUs) break;
    if (attempt === ATTEMPTS) {
      throw new Error("The old data kept changing during the upgrade. Try again in a minute.");
    }
  }

  // Without defaults (the script), a skipped unit is the app's to finish, so
  // the version isn't set yet.
  if (skipped.length === 0) {
    await redis.set(KEYS.migratedAt, now, { nx: true });
    await redis.set(KEYS.schemaVersion, SCHEMA_VERSION);
  }
  return { alreadyDone: false, converted, skipped };
}

/** For --dry-run: each unit's name, old record count, new record count, and whether it already ran. */
export async function describeMigration(redis, { defaults } = {}) {
  const { units, skipped } = await plan(redis, defaults);
  const done = new Set((await redis.smembers(KEYS.migrated)) ?? []);
  return {
    schemaVersion: Number(await redis.get(KEYS.schemaVersion)) || 1,
    units: units.map((u) => ({
      name: u.name,
      alreadyConverted: done.has(u.name),
      oldRecords: u.legacyCount,
      newRecords: Object.fromEntries(u.targets.map((t) => [t.key, t.records.length])),
    })),
    skipped,
  };
}

async function scanKeys(redis, match) {
  const found = [];
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, { match, count: 500 });
    found.push(...keys);
    cursor = String(next);
  } while (cursor !== "0");
  return found;
}

/** Every old-layout key still in Redis. */
export async function legacyKeys(redis) {
  const fixed = [
    LEGACY_KEYS.semesters,
    LEGACY_KEYS.categories,
    LEGACY_KEYS.equipment,
    LEGACY_KEYS.drinkGroups,
    LEGACY_KEYS.drinkPresets,
    LEGACY_KEYS.customDrinkItems,
  ];
  const present = [];
  for (const key of fixed) {
    if (await redis.exists(key)) present.push(key);
  }
  for (const pattern of LEGACY_PATTERNS) present.push(...(await scanKeys(redis, pattern)));
  return present;
}

/**
 * Deletes the old keys once the deployment has been on version 2 for
 * LEGACY_RETENTION_MS, or right away with `force` (the script's --cleanup).
 * Never before the migration has finished. Returns the keys deleted, or null
 * when it's not time yet.
 */
export async function deleteLegacyKeys(redis, { now = Date.now(), force = false } = {}) {
  const [version, migratedAt, alreadyDeleted] = await redis.mget(
    KEYS.schemaVersion,
    KEYS.migratedAt,
    LEGACY_DELETED_KEY,
  );
  if (Number(version) < SCHEMA_VERSION) return null;
  if (alreadyDeleted && !force) return [];
  if (!force && now - Number(migratedAt) < LEGACY_RETENTION_MS) return null;

  const keys = await legacyKeys(redis);
  if (keys.length > 0) await redis.del(...keys);
  await redis.set(LEGACY_DELETED_KEY, now);
  return keys;
}

const stripStorageFields = ({ sortOrder: _sortOrder, groupId: _groupId, ...rest }) => rest;
const listFrom = (hash) => hashValues(hash).sort(bySortOrder).map(stripStorageFields);

/**
 * Writes the hashes back to the old keys, then removes the hashes and the
 * version markers, so the previous release sees every edit made since the
 * upgrade and a later upgrade starts over cleanly. Run it right after
 * rolling Vercel back to the release before this one.
 */
export async function rollbackToV1(redis) {
  const [semesters, categories, equipment, groups, items, presets] = await Promise.all([
    redis.hgetall(KEYS.semesters),
    redis.hgetall(KEYS.categories),
    redis.hgetall(KEYS.equipment),
    redis.hgetall(KEYS.drinkGroups),
    redis.hgetall(KEYS.drinkItems),
    redis.hgetall(KEYS.drinkPresets),
  ]);
  const semesterList = listFrom(semesters);
  const writes = {
    [LEGACY_KEYS.semesters]: semesterList,
    [LEGACY_KEYS.categories]: listFrom(categories),
    [LEGACY_KEYS.equipment]: listFrom(equipment),
    [LEGACY_KEYS.drinkGroups]: assembleDrinkGroups(groups, items),
    [LEGACY_KEYS.drinkPresets]: presets ?? {},
  };
  for (const { id } of semesterList) {
    const [events, markers, contacts] = await Promise.all([
      redis.hgetall(KEYS.events(id)),
      redis.hgetall(KEYS.markers(id)),
      redis.hgetall(KEYS.contacts(id)),
    ]);
    writes[LEGACY_KEYS.events(id)] = listFrom(events);
    writes[LEGACY_KEYS.markers(id)] = listFrom(markers);
    writes[LEGACY_KEYS.contacts(id)] = listFrom(contacts);
  }
  for (const [key, value] of Object.entries(writes)) await redis.set(key, value);

  const v2 = await scanKeys(redis, "v2:*");
  await redis.del(KEYS.schemaVersion, ...v2);
  return Object.keys(writes);
}
