import { describe, it, expect } from "vitest";
import { parseDrinkGroupsForm, parseDrinkPresetsForm, parseNewDrinkItem } from "@/lib/forms/drinks";

const form = (entries) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

describe("parseDrinkGroupsForm", () => {
  it("reads groups and items in form order, with prices in dollars", () => {
    const result = parseDrinkGroupsForm(
      form([
        ["group::g1::label", "Liquor"],
        ["item::g1::i1::name", "Vodka"],
        ["item::g1::i1::price", "14.79"],
        ["group::g2::label", ""],
        ["item::g2::i2::name", "Cups"],
        ["item::g2::i2::price", ""],
      ]),
      new Set(["i1", "i2"]),
    );
    expect(result.data).toEqual([
      { id: "g1", label: "Liquor", items: [{ id: "i1", name: "Vodka", price: 14.79 }] },
      { id: "g2", label: "Untitled group", items: [{ id: "i2", name: "Cups", price: 0 }] },
    ]);
  });

  it("refuses to drop a saved item whose name was cleared or duplicated", () => {
    const cleared = form([["group::g1::label", "Liquor"], ["item::g1::i1::name", ""]]);
    expect(parseDrinkGroupsForm(cleared, new Set(["i1"])).ok).toBe(false);
    expect(parseDrinkGroupsForm(cleared, new Set()).data).toEqual([{ id: "g1", label: "Liquor", items: [] }]);

    const duplicate = form([
      ["group::g1::label", "Liquor"],
      ["item::g1::i1::name", "Vodka"],
      ["item::g1::i2::name", "vodka"],
    ]);
    expect(parseDrinkGroupsForm(duplicate, new Set(["i1", "i2"])).error).toBe(
      'Two items are both named "vodka". Give one a different name.',
    );
  });

  it("refuses a bad price, naming the item", () => {
    const bad = form([["group::g1::label", "L"], ["item::g1::i1::name", "Vodka"], ["item::g1::i1::price", "-3"]]);
    expect(parseDrinkGroupsForm(bad, new Set()).error).toBe("Vodka: A price can't be negative.");
  });
});

describe("parseDrinkPresetsForm", () => {
  it("keeps positive whole quantities and leaves out blanks and zeros", () => {
    const result = parseDrinkPresetsForm(
      form([["preset::mixer::vodka", "2"], ["preset::mixer::rum", "0"], ["preset::party::vodka", ""], ["other", "9"]]),
    );
    expect(result.data).toEqual({ mixer: { vodka: 2 } });
  });

  it("refuses negatives, fractions, and huge numbers", () => {
    for (const qty of ["-3", "1.5", "1000", "lots"]) {
      expect(parseDrinkPresetsForm(form([["preset::mixer::vodka", qty]])).ok).toBe(false);
    }
  });
});

describe("parseNewDrinkItem", () => {
  const groups = [{ id: "g1", label: "Liquor", items: [{ id: "i1", name: "Vodka", price: 14.79 }] }];
  const item = (fields) => form(Object.entries({ itemName: "Rum", itemGroupId: "g1", itemPrice: "20", ...fields }));

  it("returns the new item", () => {
    expect(parseNewDrinkItem(item({ itemId: "i9" }), groups).data).toEqual({ id: "i9", groupId: "g1", name: "Rum", price: 20 });
  });

  it("refuses a duplicate name, a missing group, and a missing or bad price", () => {
    expect(parseNewDrinkItem(item({ itemName: "VODKA" }), groups).error).toBe('There\'s already an item named "VODKA".');
    expect(parseNewDrinkItem(item({ itemGroupId: "gone" }), groups).error).toBe("Pick a group for the item.");
    expect(parseNewDrinkItem(item({ itemPrice: "" }), groups).error).toBe("Enter a price for the item.");
    expect(parseNewDrinkItem(item({ itemPrice: "free" }), groups).error).toBe("A price must be a dollar amount.");
  });
});
