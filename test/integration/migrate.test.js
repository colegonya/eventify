import { describe, it, expect, vi, beforeEach } from "vitest";
import { redis, resetDatabase, newRequest } from "./redis.js";
import {
  deleteLegacyKeys,
  describeMigration,
  LEGACY_RETENTION_MS,
  migrateToV2,
  rollbackToV1,
} from "@/lib/migrate";

// The upgrade against a real Redis, starting from data in the old layout.

vi.mock("server-only", () => ({}));
vi.mock("react", async () => ({ cache: (await import("./redis.js")).requestCache }));
vi.mock("@/lib/kv", async () => ({ kv: (await import("./redis.js")).countingRedis }));

async function freshData() {
  vi.resetModules();
  newRequest();
  return import("@/lib/data");
}

const defaults = {
  categories: [{ id: "starter", label: "Starter" }],
  drinkGroups: [],
  drinkPresets: {},
};

const fall = { id: "fall-2026", label: "Fall 2026", startDate: "2026-08-20", endDate: "2026-12-15", maxBudgetCents: 500000 };
const spring = { id: "spring-2027", label: "Spring 2027", startDate: "2027-01-10", endDate: "2027-05-10", maxBudgetCents: 400000 };

// A deployment as the release before this one left it.
async function seedOldLayout() {
  await redis.set("semesters", [spring, fall]);
  await redis.set("categories", [
    { id: "social", label: "Social", color: "#ff0000" },
    { id: "formal", label: "Formal", color: "#00ff00" },
  ]);
  await redis.set("events:fall-2026", [
    { id: "e1", semesterId: fall.id, name: "Mixer", lineItems: [], drinks: {} },
    { id: "e2", semesterId: fall.id, name: "Formal", lineItems: [{ label: "Venue", amountCents: 50000 }] },
  ]);
  await redis.set("gamedays:fall-2026", [{ id: "m1", semesterId: fall.id, date: "2026-10-10", opponent: "Rival State" }]);
  await redis.set("contacts:fall-2026", [
    { id: "zed", semesterId: fall.id, position: "President", org: "Kappa" },
    { id: "amy", semesterId: fall.id, position: "Social Chair", org: "Kappa" },
  ]);
  await redis.set("equipment", [{ id: "speaker", name: "Speaker", purchasedSemesterId: fall.id }]);
  await redis.set("drinkGroups", [
    { id: "beer", label: "Beer", items: [{ id: "lager", name: "Lager", price: 20 }] },
    { id: "wine", label: "Wine", items: [{ id: "red", name: "Red", price: 15 }] },
  ]);
  await redis.set("drinkPresets", { social: { lager: 4 } });
  await redis.set("branding", { chapterName: "Pike" });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("migrateToV2", () => {
  it("shows every record through the app exactly as before, in the same order", async () => {
    await seedOldLayout();
    const data = await freshData();

    expect((await data.getSemesters()).map((s) => s.id)).toEqual([spring.id, fall.id]);
    expect((await data.getCategories()).map((c) => c.label)).toEqual(["Social", "Formal"]);
    const events = await data.getEvents(fall.id);
    expect(events.find((e) => e.id === "e1")).toMatchObject({ lineItems: [], drinks: {} });
    expect(events.find((e) => e.id === "e2").lineItems).toEqual([{ label: "Venue", amountCents: 50000 }]);
    expect(await data.getMarkers(fall.id)).toEqual([
      { id: "m1", semesterId: fall.id, date: "2026-10-10", label: "vs. Rival State" },
    ]);
    expect((await data.getContacts(fall.id)).map((c) => c.id)).toEqual(["zed", "amy"]);
    expect((await data.getEquipmentItems()).map((i) => i.id)).toEqual(["speaker"]);
    expect(await data.getDrinkGroups()).toEqual([
      { id: "beer", label: "Beer", items: [{ id: "lager", name: "Lager", price: 20 }] },
      { id: "wine", label: "Wine", items: [{ id: "red", name: "Red", price: 15 }] },
    ]);
    expect(await data.getDrinkPresets()).toEqual({ social: { lager: 4 } });
    expect((await data.getBrandingSettings()).chapterName).toBe("Pike");
  });

  it("converts each part exactly once when several instances start together", async () => {
    await seedOldLayout();
    const runs = await Promise.all([1, 2, 3, 4].map(() => migrateToV2(redis, { defaults })));

    const converted = runs.flatMap((r) => r.converted);
    expect(converted.length).toBe(new Set(converted).size);
    expect(new Set(converted)).toEqual(new Set((await redis.smembers("v2:migrated")) ?? []));
    expect(await redis.get("schemaVersion")).toBe(2);
    expect((await migrateToV2(redis, { defaults })).alreadyDone).toBe(true);
  });

  it("doesn't bring back records deleted between two instances' runs", async () => {
    await seedOldLayout();
    await migrateToV2(redis, { defaults });
    // Every contact deleted, so their hash is gone, and then another instance
    // that hasn't seen the version yet runs the upgrade.
    await redis.hdel("v2:contacts:fall-2026", "zed", "amy");
    await redis.del("schemaVersion");

    await migrateToV2(redis, { defaults });
    expect(await redis.hgetall("v2:contacts:fall-2026")).toBeNull();
  });

  it("rebuilds a part when the old release writes to it mid-upgrade", async () => {
    await seedOldLayout();
    // The old release saves a contact between the read and the write.
    const realEval = redis.eval.bind(redis);
    let interfered = false;
    const racing = new Proxy(redis, {
      get(target, prop) {
        if (prop !== "eval") return typeof target[prop] === "function" ? target[prop].bind(target) : target[prop];
        return async (script, keys, args) => {
          if (!interfered && keys.includes("contacts:fall-2026") && args[0] === "contacts:fall-2026") {
            interfered = true;
            await redis.set("contacts:fall-2026", [{ id: "late", semesterId: fall.id, position: "Added late" }]);
          }
          return realEval(script, keys, args);
        };
      },
    });

    await migrateToV2(racing, { defaults });
    expect(interfered).toBe(true);
    expect(Object.keys(await redis.hgetall("v2:contacts:fall-2026"))).toEqual(["late"]);
  });

  it("dry run reports what the real run then converts, and writes nothing", async () => {
    await seedOldLayout();
    const report = await describeMigration(redis, { defaults });
    expect(await redis.exists("v2:semesters", "v2:migrated", "schemaVersion")).toBe(0);

    const contacts = report.units.find((u) => u.name === "contacts:fall-2026");
    expect(contacts).toMatchObject({ oldRecords: 2, newRecords: { "v2:contacts:fall-2026": 2 }, alreadyConverted: false });

    const { converted } = await migrateToV2(redis, { defaults });
    expect(new Set(converted)).toEqual(new Set(report.units.map((u) => u.name)));
  });

  it("without defaults, leaves the missing parts for the app and doesn't finish", async () => {
    await redis.set("semesters", [fall]);
    const result = await migrateToV2(redis);
    expect(result.skipped).toEqual(["categories", "drinks"]);
    expect(await redis.get("schemaVersion")).toBeNull();

    // The app then finishes with its defaults.
    const data = await freshData();
    expect((await data.getCategories()).length).toBeGreaterThan(0);
    expect(await redis.get("schemaVersion")).toBe(2);
  });
});

describe("deleteLegacyKeys", () => {
  it("keeps the old keys for a week, then deletes them and nothing else", async () => {
    await seedOldLayout();
    await redis.set("contacts:deleted-semester", []);
    const start = 1_000_000;
    await migrateToV2(redis, { defaults, now: start });

    expect(await deleteLegacyKeys(redis, { now: start + LEGACY_RETENTION_MS - 1 })).toBeNull();
    expect(await redis.exists("semesters")).toBe(1);

    const deleted = await deleteLegacyKeys(redis, { now: start + LEGACY_RETENTION_MS });
    expect(deleted.sort()).toEqual(
      [
        "semesters",
        "categories",
        "equipment",
        "drinkGroups",
        "drinkPresets",
        "events:fall-2026",
        "gamedays:fall-2026",
        "contacts:fall-2026",
        "contacts:deleted-semester",
      ].sort(),
    );
    expect(await redis.exists("v2:semesters", "v2:events:fall-2026", "branding")).toBe(3);
  });

  it("never deletes before the upgrade has finished, even when forced", async () => {
    await seedOldLayout();
    expect(await deleteLegacyKeys(redis, { force: true })).toBeNull();
    expect(await redis.exists("semesters")).toBe(1);
  });
});

describe("rollbackToV1", () => {
  it("writes edits made after the upgrade back to the old keys and removes the new ones", async () => {
    await seedOldLayout();
    const data = await freshData();
    await data.saveEvent({ id: "e3", semesterId: fall.id, name: "Date Party", lineItems: [] });
    await data.saveContactChanges(fall.id, [{ id: "new", semesterId: fall.id, position: "Treasurer" }], ["zed"]);
    await data.addDrinkItemToGroup("wine", { id: "white", name: "White", price: 14 });

    await rollbackToV1(redis);

    expect((await redis.get("events:fall-2026")).map((e) => e.id)).toEqual(["e1", "e2", "e3"]);
    expect(await redis.get("gamedays:fall-2026")).toEqual([
      { id: "m1", semesterId: fall.id, date: "2026-10-10", opponent: "Rival State" },
    ]);
    expect(await redis.get("contacts:fall-2026")).toEqual([
      { id: "amy", semesterId: fall.id, position: "Social Chair", org: "Kappa" },
      { id: "new", semesterId: fall.id, position: "Treasurer" },
    ]);
    expect((await redis.get("drinkGroups"))[1].items.map((i) => i.id)).toEqual(["red", "white"]);
    expect((await redis.get("semesters")).map((s) => s.id)).toEqual([spring.id, fall.id]);
    expect(await redis.exists("schemaVersion", "v2:semesters", "v2:migrated")).toBe(0);
  });
});
