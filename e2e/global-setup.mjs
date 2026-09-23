import { testRedis } from "./support.mjs";

// Every run starts from an empty database, the same state as a fresh deploy.
export default async function globalSetup() {
  await testRedis().flushdb();
}
