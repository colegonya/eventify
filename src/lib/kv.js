import { Redis } from "@upstash/redis";

// Storage layer for the app's shared data (semesters, events, game days).
// Backed by Upstash Redis (Vercel's current recommended KV integration —
// "Vercel KV" itself is deprecated in favor of this). Reads its connection
// details from the env vars the Vercel/Upstash integration injects:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
//
// Two retries instead of the client's default five. Five back off for about
// 4.3 seconds in total, on top of each attempt's own wait, before a failure
// reaches anyone; two back off for under 0.2 seconds. The autosave retries
// on its own and tells the officer it's doing so, and two still cover a
// one-off dropped connection.
export const kv = Redis.fromEnv({ retry: { retries: 2 } });
