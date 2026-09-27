import { describe, it, expect, vi, beforeEach } from "vitest";
import { redis, probe, resetDatabase, newRequest } from "./redis.js";

// data.js against a real Redis. Each freshData() is a new server instance.

vi.mock("server-only", () => ({}));
vi.mock("react", async () => ({ cache: (await import("./redis.js")).requestCache }));
vi.mock("@/lib/kv", async () => ({ kv: (await import("./redis.js")).countingRedis }));

async function freshData() {
  vi.resetModules();
  newRequest();
  return import("@/lib/data");
}

const fall = { id: "fall-2026", label: "Fall 2026", startDate: "2026-08-20", endDate: "2026-12-15", maxBudgetCents: 500000 };
const spring = { id: "spring-2027", label: "Spring 2027", startDate: "2027-01-10", endDate: "2027-05-10", maxBudgetCents: 500000 };
const event = (id, name) => ({ id, semesterId: fall.id, name, startDate: "2026-09-01", endDate: "2026-09-01", lineItems: [] });
const contact = (id, position) => ({ id, semesterId: fall.id, org: "Kappa", position, status: "Reached Out", phone: "", meetingDate: null, notes: "" });

beforeEach(async () => {
  await resetDatabase();
});

async function setUp() {
  const data = await freshData();
  await data.saveSemester(fall);
  return data;
}

describe("reads", () => {
  it("loads what every page needs in one request once the instance is warm", async () => {
    const data = await setUp();
    newRequest();

    await Promise.all([
      data.getSemesters(),
      data.getBrandingSettings(),
      data.getBrandingSettings(),
      data.isOnboardingChecklistDismissed(),
      data.getCategories(),
      data.getDrinkGroups(),
      data.getDrinkPresets(),
    ]);

    expect(probe.requests).toEqual(["pipeline"]);
  });

  it("fills a new deployment with the default categories and drink catalog", async () => {
    const data = await freshData();
    expect((await data.getCategories()).length).toBeGreaterThan(0);
    expect((await data.getDrinkGroups()).length).toBeGreaterThan(0);
    expect(Object.keys(await data.getDrinkPresets()).length).toBeGreaterThan(0);
  });
});

describe("saves that happen at the same time", () => {
  it("keeps both of two events saved at the same moment", async () => {
    const data = await setUp();
    await data.saveEvent(event("mixer", "Mixer"));
    await data.saveEvent(event("formal", "Formal"));

    // Two officers, two server instances, two different events.
    const [a, b] = [await freshData(), await freshData()];
    await Promise.all([a.saveEvent(event("mixer", "Mixer (moved)")), b.saveEvent(event("formal", "Formal (renamed)"))]);

    const names = (await (await freshData()).getEvents(fall.id)).map((e) => e.name).sort();
    expect(names).toEqual(["Formal (renamed)", "Mixer (moved)"]);
  });

  it("keeps both of two contact edits saved at the same moment", async () => {
    const data = await setUp();
    await data.saveContactChanges(fall.id, [contact("c1", "President"), contact("c2", "Social Chair")], []);

    const [a, b] = [await freshData(), await freshData()];
    await Promise.all([
      a.saveContactChanges(fall.id, [{ ...contact("c1", "President"), phone: "555-0100" }], []),
      b.saveContactChanges(fall.id, [{ ...contact("c2", "Social Chair"), notes: "Call Friday" }], []),
    ]);

    const saved = await (await freshData()).getContacts(fall.id);
    expect(saved.map((c) => [c.id, c.phone, c.notes])).toEqual([
      ["c1", "555-0100", ""],
      ["c2", "", "Call Friday"],
    ]);
  });

  it("refuses to delete the last two semesters when both are deleted at once", async () => {
    const data = await setUp();
    await data.saveSemester(spring);

    const results = await Promise.allSettled([
      (await freshData()).deleteSemester(fall.id),
      (await freshData()).deleteSemester(spring.id),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await (await freshData()).getSemesters()).toHaveLength(1);
  });
});

describe("saves", () => {
  it("leaves no phantom semester behind when the write fails", async () => {
    const data = await setUp();
    const before = await data.getSemesters();

    probe.failWrites = true;
    await expect(data.saveSemester(spring)).rejects.toThrow("connection reset");
    probe.failWrites = false;

    expect(before.map((s) => s.id)).toEqual([fall.id]);
    expect((await (await freshData()).getSemesters()).map((s) => s.id)).toEqual([fall.id]);
  });

  it("doesn't change a list the page already read when it saves", async () => {
    const data = await setUp();
    const before = await data.getSemesters();

    await data.saveSemester(spring);
    await data.saveSemester({ ...fall, label: "Fall 2026 (renamed)" });

    expect(before.map((s) => s.label)).toEqual(["Fall 2026"]);
    const after = await (await freshData()).getSemesters();
    expect(after.map((s) => s.label)).toEqual(["Fall 2026 (renamed)", "Spring 2027"]);
  });

  it("keeps rows in the order they were added, and a new row goes last", async () => {
    const data = await setUp();
    await data.saveContactChanges(fall.id, [contact("z", "First"), contact("a", "Second")], []);
    await data.saveContactChanges(fall.id, [contact("m", "Third"), contact("z", "First (edited)")], []);

    const saved = await (await freshData()).getContacts(fall.id);
    expect(saved.map((c) => c.position)).toEqual(["First (edited)", "Second", "Third"]);
  });

  it("deletes a removed row and leaves the others alone", async () => {
    const data = await setUp();
    await data.saveContactChanges(fall.id, [contact("c1", "A"), contact("c2", "B")], []);
    await data.saveContactChanges(fall.id, [], ["c1"]);
    expect((await data.getContacts(fall.id)).map((c) => c.id)).toEqual(["c2"]);
  });

  it("keeps an emptied category list empty on the next instance", async () => {
    const data = await setUp();
    const ids = (await data.getCategories()).map((c) => c.id);
    await data.saveCategoryChanges([], ids);

    const next = await freshData();
    await next.ensureDefaults();
    expect(await next.getCategories()).toEqual([]);
  });

  it("adds a drink item to the end of its group, and ignores one for a missing group", async () => {
    const data = await setUp();
    const [group] = await data.getDrinkGroups();

    await data.addDrinkItemToGroup(group.id, { id: "house-lager", name: "House Lager", price: 20 });
    await data.addDrinkItemToGroup("no-such-group", { id: "gin", name: "Gin", price: 15 });

    newRequest();
    const groups = await data.getDrinkGroups();
    expect(groups[0].items.at(-1)).toEqual({ id: "house-lager", name: "House Lager", price: 20 });
    expect(groups.flatMap((g) => g.items).some((i) => i.id === "gin")).toBe(false);
  });

  it("deletes a drink group's items along with it and leaves other groups alone", async () => {
    const data = await setUp();
    const [first, second] = await data.getDrinkGroups();
    await data.saveDrinkCatalogChanges({
      groups: [],
      items: [],
      deletedGroupIds: [first.id],
      deletedItemIds: first.items.map((i) => i.id),
    });

    newRequest();
    const groups = await data.getDrinkGroups();
    expect(groups[0]).toEqual(second);
    expect(Object.keys((await redis.hgetall("v2:drinkItems")) ?? {})).not.toContain(first.items[0]?.id);
  });

  it("stores a preset per category and deletes one with nothing left", async () => {
    const data = await setUp();
    await data.saveDrinkPresetChanges({ mixer: { a: 2 }, party: {} });
    newRequest();
    const presets = await data.getDrinkPresets();
    expect(presets.mixer).toEqual({ a: 2 });
    expect(presets.party).toBeUndefined();
  });

  it("drops a deleted semester's data and returns its equipment to the wishlist", async () => {
    const data = await setUp();
    await data.saveSemester(spring);
    await data.saveEvent({ ...event("e1", "Mixer"), semesterId: spring.id });
    await data.saveEquipmentItem({ id: "speaker", name: "Speaker", purchasedSemesterId: spring.id });
    await data.saveEquipmentItem({ id: "lights", name: "Lights", purchasedSemesterId: fall.id });

    await data.deleteSemester(spring.id);

    expect(await redis.exists("v2:events:spring-2027")).toBe(0);
    const items = await data.getEquipmentItems();
    expect(items.map((i) => [i.id, i.purchasedSemesterId])).toEqual([
      ["speaker", null],
      ["lights", fall.id],
    ]);
  });

  it("renames the chapter only on the events it hosted", async () => {
    const data = await setUp();
    await data.saveEvent({ ...event("ours", "Mixer"), host: "Pike" });
    await data.saveEvent({ ...event("theirs", "Gala"), host: "Kappa" });

    await data.renameChapterInEventHosts("Pike", "Pi Kappa Alpha");

    const hosts = Object.fromEntries((await data.getEvents(fall.id)).map((e) => [e.id, e.host]));
    expect(hosts).toEqual({ ours: "Pi Kappa Alpha", theirs: "Kappa" });
  });
});

describe("a running instance", () => {
  it("upgrades again if the data is rolled back underneath it", async () => {
    const data = await setUp();
    await redis.flushdb();
    await redis.set("semesters", [spring]);

    newRequest();
    expect((await data.getSemesters()).map((s) => s.id)).toEqual([spring.id]);
    expect((await data.getCategories()).length).toBeGreaterThan(0);
  });
});

describe("deleting the old keys", () => {
  async function upgradedAWeekAgo() {
    await redis.set("semesters", [fall]);
    const data = await freshData();
    await data.getSemesters();
    await redis.set("v2:migratedAt", Date.now() - 8 * 24 * 60 * 60 * 1000);
  }

  it("happens on a production instance once the week is up", async () => {
    await upgradedAWeekAgo();
    vi.stubEnv("VERCEL_ENV", "production");
    try {
      await (await freshData()).ensureDefaults();
    } finally {
      vi.unstubAllEnvs();
    }
    expect(await redis.exists("semesters")).toBe(0);
  });

  it("never happens on a preview, which can share production's database", async () => {
    await upgradedAWeekAgo();
    vi.stubEnv("VERCEL_ENV", "preview");
    try {
      await (await freshData()).ensureDefaults();
    } finally {
      vi.unstubAllEnvs();
    }
    expect(await redis.exists("semesters")).toBe(1);
  });
});
