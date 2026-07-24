import { Redis } from "@upstash/redis";

// Storage layer for the app's shared data (semesters, events, game days).
// Backed by Upstash Redis (Vercel's current recommended KV integration —
// "Vercel KV" itself is deprecated in favor of this). Reads its connection
// details from the env vars the Vercel/Upstash integration injects:
//   UPSTASH_REDIS_REST_URL
//   UPSTASH_REDIS_REST_TOKEN
export const kv = Redis.fromEnv();
