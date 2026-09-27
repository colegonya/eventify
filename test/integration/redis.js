import { testRedis } from "../../e2e/support.mjs";

// The local test database (the same one the browser tests use), wrapped so
// a test can count what crosses the network and make writes fail. Refuses
// any host that isn't local: every test here empties the database.
export const redis = testRedis();

// On globalThis because vi.resetModules() (a new server instance per test)
// hands data.js a fresh copy of this module, and the test and data.js must
// see the same counters.
globalThis.__redisProbe ??= { requests: [], failWrites: false, memo: new Map() };
export const probe = globalThis.__redisProbe;

const WRITES = new Set(["set", "hset", "hdel", "del", "eval"]);

// A pipeline or transaction is one request, counted when it's sent.
export const countingRedis = new Proxy(redis, {
  get(target, prop) {
    const value = target[prop];
    if (typeof value !== "function") return value;
    if (prop === "pipeline" || prop === "multi") {
      return () => {
        const batch = value.call(target);
        const exec = batch.exec.bind(batch);
        batch.exec = async () => {
          probe.requests.push(prop);
          return exec();
        };
        return batch;
      };
    }
    return (...args) => {
      probe.requests.push(prop);
      if (probe.failWrites && WRITES.has(prop)) return Promise.reject(new Error("connection reset"));
      return value.apply(target, args);
    };
  },
});

export async function resetDatabase() {
  probe.requests.length = 0;
  probe.failWrites = false;
  await redis.flushdb();
}

// React's cache() only memoizes inside a server render. This stands in for
// one: everything until the next newRequest() shares reads.
export function requestCache(fn) {
  return (...args) => {
    if (!probe.memo.has(fn)) probe.memo.set(fn, fn(...args));
    return probe.memo.get(fn);
  };
}

export function newRequest() {
  probe.memo.clear();
  probe.requests.length = 0;
}
