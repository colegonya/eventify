import { describe, it, expect } from "vitest";
import { buildPlan } from "@/lib/migrationPlan";

const stored = (value) => ({ digest: `sha:${JSON.stringify(value).length}`, value });
const defaults = {
  categories: [{ id: "mixer", label: "Mixer" }],
  drinkGroups: [{ id: "beer", label: "Beer", items: [{ id: "lager", name: "Lager", price: 20 }] }],
  drinkPresets: { mixer: { lager: 2 } },
};
const unit = (plan, name) => plan.units.find((u) => u.name === name);
const records = (plan, name, key) => unit(plan, name).targets.find((t) => t.key === key).records;

describe("buildPlan", () => {
  const legacy = {
    semesters: stored([{ id: "fall", label: "Fall" }, { id: "spring", label: "Spring" }]),
    categories: stored([{ id: "social", label: "Social" }, { id: "formal", label: "Formal" }]),
    "events:fall": stored([{ id: "e1", semesterId: "fall", lineItems: [] }]),
    "contacts:fall": stored([{ id: "c1", position: "President" }, { id: "c2", position: "Social Chair" }]),
    "gamedays:fall": stored([{ id: "m1", opponent: "Rival State", date: "2026-10-10" }]),
    drinkGroups: stored([{ id: "wine", label: "Wine", items: [{ id: "red", name: "Red", price: 15 }] }]),
    drinkPresets: stored({ formal: { red: 3 }, social: {} }),
  };

  it("converts every list, keeping the order in `sortOrder`", () => {
    const plan = buildPlan(legacy, defaults);
    expect(records(plan, "semesters", "v2:semesters").map((s) => [s.id, s.sortOrder])).toEqual([
      ["fall", 0],
      ["spring", 1],
    ]);
    // A contact's own `position` (their role) is untouched by its sort order.
    expect(records(plan, "contacts:fall", "v2:contacts:fall").map((c) => [c.position, c.sortOrder])).toEqual([
      ["President", 0],
      ["Social Chair", 1],
    ]);
    // Empty lists survive as lists. Redis's Lua JSON would have made them {}.
    expect(records(plan, "events:fall", "v2:events:fall")[0].lineItems).toEqual([]);
    // Old marker records are kept as they were; reads normalize them.
    expect(records(plan, "markers:fall", "v2:markers:fall")[0].opponent).toBe("Rival State");
  });

  it("gives every semester its own units, even one with nothing stored yet", () => {
    const names = buildPlan(legacy, defaults).units.map((u) => u.name);
    expect(names).toEqual(expect.arrayContaining(["events:spring", "markers:spring", "contacts:spring"]));
    const empty = unit(buildPlan(legacy, defaults), "events:spring");
    expect(empty.targets[0].records).toEqual([]);
    expect(empty.guards).toEqual({ "events:spring": "none" });
  });

  it("guards each unit on the exact old value it read", () => {
    expect(unit(buildPlan(legacy, defaults), "categories").guards).toEqual({
      categories: legacy.categories.digest,
    });
  });

  it("splits the drink catalog and drops presets with nothing in them", () => {
    const plan = buildPlan(legacy, defaults);
    expect(records(plan, "drinks", "v2:drinkGroups")).toEqual([{ id: "wine", label: "Wine", sortOrder: 0 }]);
    expect(records(plan, "drinks", "v2:drinkItems")).toEqual([
      { id: "red", groupId: "wine", name: "Red", price: 15, sortOrder: 0 },
    ]);
    expect(records(plan, "drinks", "v2:drinkPresets")).toEqual([{ id: "formal", quantities: { red: 3 } }]);
  });

  it("fills a brand-new deployment with the defaults", () => {
    const plan = buildPlan({}, defaults);
    expect(records(plan, "semesters", "v2:semesters")).toEqual([]);
    expect(records(plan, "categories", "v2:categories")).toEqual([{ id: "mixer", label: "Mixer", sortOrder: 0 }]);
    expect(records(plan, "drinks", "v2:drinkItems").map((i) => i.id)).toEqual(["lager"]);
    expect(plan.skipped).toEqual([]);
  });

  it("keeps a category list that was emptied on purpose empty", () => {
    const plan = buildPlan({ categories: stored([]) }, defaults);
    expect(records(plan, "categories", "v2:categories")).toEqual([]);
  });

  it("leaves units that need defaults for the app when run without them", () => {
    expect(buildPlan({}, undefined).skipped).toEqual(["categories", "drinks"]);
  });

  it("re-keys name-keyed presets on a deployment from before the drink catalog", () => {
    const plan = buildPlan(
      {
        customDrinkItems: stored([{ id: "gin", name: "Gin", price: 18, group: "Beer" }]),
        drinkPresets: stored({ mixer: { Lager: 4, Gin: 1, Gone: 9 } }),
      },
      defaults,
    );
    expect(records(plan, "drinks", "v2:drinkItems").map((i) => [i.id, i.groupId])).toEqual([
      ["lager", "beer"],
      ["gin", "beer"],
    ]);
    expect(records(plan, "drinks", "v2:drinkPresets")).toEqual([{ id: "mixer", quantities: { lager: 4, gin: 1 } }]);
  });
});
