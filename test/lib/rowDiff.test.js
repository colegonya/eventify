import { describe, it, expect } from "vitest";
import { rowChanges, rowSnapshot } from "@/lib/rowDiff";
import { categoryRows, contactRows, drinkCatalogRows, drinkPresetRows } from "@/lib/forms/rowKeys";

const form = (entries) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

const contact = (id, position, phone = "") => [
  ["contactId", id],
  ["contactOrg", "Kappa"],
  ["contactPosition", position],
  ["contactPhone", phone],
];

describe("rowChanges", () => {
  const loaded = form([["semesterId", "fall"], ...contact("c1", "President"), ...contact("c2", "Social Chair")]);
  const saved = rowSnapshot(loaded, contactRows);

  it("sends only the rows that changed, plus the fields every save needs", () => {
    const edited = form([["semesterId", "fall"], ...contact("c1", "President"), ...contact("c2", "Social Chair", "555")]);
    const { payload, empty } = rowChanges(edited, saved, contactRows);

    expect(empty).toBe(false);
    expect([...payload.entries()]).toEqual([["semesterId", "fall"], ...contact("c2", "Social Chair", "555")]);
  });

  it("sends a removed row's id, and a new row in full", () => {
    const edited = form([["semesterId", "fall"], ...contact("c1", "President"), ...contact("c3", "Treasurer")]);
    const { payload } = rowChanges(edited, saved, contactRows);

    expect(payload.getAll("contactId")).toEqual(["c3"]);
    expect(payload.getAll("deletedRow")).toEqual(["c2"]);
  });

  it("has nothing to send when nothing changed", () => {
    expect(rowChanges(loaded, saved, contactRows).empty).toBe(true);
  });

  it("compares the next save against what this one sent", () => {
    const edited = form([["semesterId", "fall"], ...contact("c1", "Pres"), ...contact("c2", "Social Chair")]);
    const { next } = rowChanges(edited, saved, contactRows);
    expect(rowChanges(edited, next, contactRows).empty).toBe(true);
  });

  it("counts unticking a checkbox as a change, though an unticked box sends nothing", () => {
    const ticked = form([["categoryId", "mixer"], ["categoryLabel", "Mixer"], ["categoryNetsRevenue", "mixer"]]);
    const unticked = form([["categoryId", "mixer"], ["categoryLabel", "Mixer"]]);
    const { payload, empty } = rowChanges(unticked, rowSnapshot(ticked, categoryRows), categoryRows);
    expect(empty).toBe(false);
    expect(payload.getAll("categoryId")).toEqual(["mixer"]);
  });

  it("splits the drink catalog into group rows and item rows", () => {
    const loadedCatalog = form([
      ["group::beer::label", "Beer"],
      ["item::beer::lager::name", "Lager"],
      ["item::beer::lager::price", "20"],
      ["item::beer::ipa::name", "IPA"],
      ["item::beer::ipa::price", "25"],
    ]);
    const edited = form([
      ["group::beer::label", "Beer"],
      ["item::beer::lager::name", "Lager"],
      ["item::beer::lager::price", "22"],
    ]);
    const { payload } = rowChanges(edited, rowSnapshot(loadedCatalog, drinkCatalogRows), drinkCatalogRows);
    expect([...payload.entries()]).toEqual([
      ["item::beer::lager::name", "Lager"],
      ["item::beer::lager::price", "22"],
      ["deletedRow", "i:ipa"],
    ]);
  });

  it("treats each drink preset card as one row", () => {
    const loadedPresets = form([["preset::mixer::vodka", "2"], ["preset::party::vodka", "1"]]);
    const edited = form([["preset::mixer::vodka", "3"], ["preset::party::vodka", "1"]]);
    const { payload } = rowChanges(edited, rowSnapshot(loadedPresets, drinkPresetRows), drinkPresetRows);
    expect([...payload.entries()]).toEqual([["preset::mixer::vodka", "3"]]);
  });
});
