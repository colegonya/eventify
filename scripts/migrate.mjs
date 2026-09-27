#!/usr/bin/env node
// The storage upgrade by hand. The app upgrades itself on its first request,
// so this is for looking before it does, keeping a copy, and undoing it.
//
// Reads UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from the
// environment. To point it at production, pull them from Vercel first:
//
//   npx vercel env pull .env.production.local --environment=production
//   node --env-file=.env.production.local scripts/migrate.mjs --dry-run
//
// Commands:
//   --dry-run          What the upgrade would convert, with record counts.
//                      Writes nothing.
//   --backup <file>    Saves every data key (old and new layout) to a JSON
//                      file. Login secrets and rate-limit counters are left
//                      out.
//   --migrate          Runs the upgrade now instead of waiting for a request.
//   --cleanup          Deletes the old keys now instead of a week after the
//                      upgrade. Take a --backup first.
//   --rollback         Writes the new layout back to the old keys and removes
//                      the new ones. Run it right after promoting the release
//                      before the upgrade in Vercel.

import { writeFileSync } from "node:fs";
import { Redis } from "@upstash/redis";
import {
  deleteLegacyKeys,
  describeMigration,
  migrateToV2,
  rollbackToV1,
} from "../src/lib/migrate.js";

// Secrets and counters that don't belong in a data backup.
const EXCLUDED = [/^auth/, /^loginattempts:/];

async function backup(redis, file) {
  const out = {};
  let cursor = "0";
  do {
    const [next, keys] = await redis.scan(cursor, { count: 500 });
    for (const key of keys) {
      if (EXCLUDED.some((pattern) => pattern.test(key))) continue;
      const type = await redis.type(key);
      if (type === "string") out[key] = { type, value: await redis.get(key) };
      else if (type === "hash") out[key] = { type, value: await redis.hgetall(key) };
      else if (type === "set") out[key] = { type, value: await redis.smembers(key) };
    }
    cursor = String(next);
  } while (cursor !== "0");
  writeFileSync(file, JSON.stringify(out, null, 2));
  return Object.keys(out).length;
}

async function main() {
  const [command, argument] = process.argv.slice(2);
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    console.error("Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN first (see the top of this file).");
    process.exit(1);
  }
  const redis = new Redis({ url, token });
  console.log(`Database: ${new URL(url).host}`);

  switch (command) {
    case "--dry-run": {
      const report = await describeMigration(redis);
      console.log(`Schema version: ${report.schemaVersion}`);
      for (const unit of report.units) {
        const targets = Object.entries(unit.newRecords)
          .map(([key, count]) => `${key}=${count}`)
          .join(", ");
        const state = unit.alreadyConverted ? "already converted" : "to convert";
        console.log(`  ${unit.name}: ${unit.oldRecords} old records -> ${targets} (${state})`);
      }
      if (report.skipped.length > 0) {
        console.log(`  Left for the app to fill with defaults: ${report.skipped.join(", ")}`);
      }
      break;
    }
    case "--backup": {
      if (!argument) throw new Error("Give a file name: --backup pike-backup.json");
      console.log(`Saved ${await backup(redis, argument)} keys to ${argument}`);
      break;
    }
    case "--migrate": {
      const result = await migrateToV2(redis);
      if (result.alreadyDone) console.log("Already upgraded.");
      else console.log(`Converted: ${result.converted.join(", ") || "nothing new"}`);
      if (result.skipped.length > 0) {
        console.log(`The app finishes on its next request: ${result.skipped.join(", ")}`);
      }
      break;
    }
    case "--cleanup": {
      const deleted = await deleteLegacyKeys(redis, { force: true });
      if (deleted === null) console.log("Not upgraded yet, so the old keys are the only copy. Nothing deleted.");
      else console.log(`Deleted ${deleted.length} old keys: ${deleted.join(", ") || "none left"}`);
      break;
    }
    case "--rollback": {
      const written = await rollbackToV1(redis);
      console.log(`Wrote ${written.length} old keys back and removed the new ones.`);
      break;
    }
    default:
      console.error("Usage: scripts/migrate.mjs --dry-run | --backup <file> | --migrate | --cleanup | --rollback");
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
