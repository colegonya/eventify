import { describe, it, expect, vi, beforeEach } from "vitest";

// data.js against an in-memory stand-in for Upstash, counting every request
// that would cross the network. A pipeline or mget is one request.
const { store, requests, failWrites } = vi.hoisted(() => ({
  store: new Map(),
  requests: [],
  failWrites: { on: false },
}));

vi.mock("server-only", () => ({}));

// Outside a React Server Components render, React's cache() doesn't memoize.
// This stands in for the per-request memo a real render provides.
vi.mock("react", () => ({
  cache: (fn) => {
    let result;
    return (...args) => (result ??= fn(...args));
  },
}));

vi.mock("@/lib/kv", () => {
  const clone = (value) => (value === undefined ? null : structuredClone(value));
  return {
    kv: {
      get: vi.fn(async (key) => {
        requests.push(`get ${key}`);
        return clone(store.get(key));
      }),
      mget: vi.fn(async (...keys) => {
        requests.push(`mget ${keys.join(",")}`);
        return keys.map((key) => clone(store.get(key)));
      }),
      set: vi.fn(async (key, value) => {
        requests.push(`set ${key}`);
        if (failWrites.on) throw new Error("connection reset");
        store.set(key, clone(value));
        return "OK";
      }),
    },
  };
});

// A fresh copy of data.js per test: the old code kept its cache at module
// level, and each test here is a separate request.
async function freshData() {
  vi.resetModules();
  return import("@/lib/data");
}

const fall = { id: "fall-2026", label: "Fall 2026", startDate: "2026-08-20", endDate: "2026-12-15", maxBudgetCents: 500000 };
const spring = { id: "spring-2027", label: "Spring 2027", startDate: "2027-01-10", endDate: "2027-05-10", maxBudgetCents: 500000 };

beforeEach(() => {
  store.clear();
  requests.length = 0;
  failWrites.on = false;
  store.set("semesters", [fall]);
  store.set("branding", { chapterName: "Pike" });
  store.set("categories", [{ id: "social", label: "Social", color: "#ff0000" }]);
});

describe("data.js reads", () => {
  it("loads what every page needs in one request", async () => {
    const data = await freshData();

    await Promise.all([
      data.getSemesters(),
      data.getBrandingSettings(),
      data.getBrandingSettings(),
      data.isOnboardingChecklistDismissed(),
      data.getCategories(),
      data.getDrinkGroups(),
      data.getDrinkPresets(),
    ]);

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^mget /);
  });
});

describe("data.js saves", () => {
  it("leaves no phantom semester behind when the write fails", async () => {
    const data = await freshData();
    const before = await data.getSemesters();

    failWrites.on = true;
    await expect(data.saveSemester(spring)).rejects.toThrow("connection reset");

    // Neither what this request already read, nor the next request's read.
    expect(before.map((s) => s.id)).toEqual(["fall-2026"]);
    const next = await freshData();
    expect((await next.getSemesters()).map((s) => s.id)).toEqual(["fall-2026"]);
  });

  it("doesn't change a list the page already read when it saves", async () => {
    const data = await freshData();
    const before = await data.getSemesters();

    await data.saveSemester(spring);
    await data.saveSemester({ ...fall, label: "Fall 2026 (renamed)" });

    expect(before).toEqual([fall]);
    expect(store.get("semesters").map((s) => s.label)).toEqual(["Fall 2026 (renamed)", "Spring 2027"]);
  });

  it("adds a drink item without editing the catalog it read", async () => {
    store.set("drinkGroups", [{ id: "beer", label: "Beer", items: [] }]);
    const data = await freshData();
    const before = await data.getDrinkGroups();

    await data.addDrinkItemToGroup("beer", { id: "lager", name: "Lager", price: 20 });

    expect(before[0].items).toEqual([]);
    expect(store.get("drinkGroups")[0].items).toEqual([{ id: "lager", name: "Lager", price: 20 }]);
  });

  it("ignores a drink item for a group that doesn't exist", async () => {
    store.set("drinkGroups", [{ id: "beer", label: "Beer", items: [] }]);
    const data = await freshData();

    await data.addDrinkItemToGroup("wine", { id: "red", name: "Red", price: 15 });

    expect(requests.some((r) => r.startsWith("set"))).toBe(false);
  });

  it("updates an event in place and adds a new one at the end", async () => {
    store.set("events:fall-2026", [{ id: "a", semesterId: "fall-2026", name: "Mixer" }]);
    const data = await freshData();

    await data.saveEvent({ id: "a", semesterId: "fall-2026", name: "Mixer (moved)" });
    await data.saveEvent({ id: "b", semesterId: "fall-2026", name: "Formal" });

    expect(store.get("events:fall-2026").map((e) => e.name)).toEqual(["Mixer (moved)", "Formal"]);
  });
});
