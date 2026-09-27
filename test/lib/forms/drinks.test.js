import { describe, it, expect } from "vitest";
import { parseDrinkGroupsForm, parseDrinkPresetsForm, parseNewDrinkItem } from "@/lib/forms/drinks";

const form = (entries) => {
  const data = new FormData();
  for (const [key, value] of entries) data.append(key, value);
  return data;
};

describe("parseDrinkGroupsForm", () => {
  const empty = { groups: [], items: [] };
  const stored = {
    groups: [{ id: "g1", label: "Liquor", position: 0 }],
    items: [
      { id: "i1", groupId: "g1", name: "Vodka", price: 14.79, position: 0 },
      { id: "i2", groupId: "g1", name: "Rum", price: 20, position: 1 },
    ],
  };

  it("reads the groups and items sent, with prices in dollars", () => {
    const result = parseDrinkGroupsForm(
      form([
        ["group::g1::label", "Liquor"],
        ["item::g1::i1::name", "Vodka"],
        ["item::g1::i1::price", "14.79"],
        ["group::g2::label", ""],
        ["item::g2::i3::name", "Cups"],
        ["item::g2::i3::price", ""],
      ]),
      stored,
    );
    expect(result.data).toEqual({
      groups: [
        { id: "g1", label: "Liquor" },
        { id: "g2", label: "Untitled group" },
      ],
      items: [
        { id: "i1", groupId: "g1", name: "Vodka", price: 14.79 },
        { id: "i3", groupId: "g2", name: "Cups", price: 0 },
      ],
      deletedGroupIds: [],
      deletedItemIds: [],
    });
  });

  it("accepts an item sent without its group, when the group is saved", () => {
    const result = parseDrinkGroupsForm(form([["item::g1::i2::name", "Dark rum"], ["item::g1::i2::price", "22"]]), stored);
    expect(result.data.items).toEqual([{ id: "i2", groupId: "g1", name: "Dark rum", price: 22 }]);
  });

  it("refuses to drop a saved item whose name was cleared", () => {
    const cleared = form([["item::g1::i1::name", ""]]);
    expect(parseDrinkGroupsForm(cleared, stored).ok).toBe(false);
    const unsaved = form([["group::g1::label", "Liquor"], ["item::g1::new::name", ""]]);
    expect(parseDrinkGroupsForm(unsaved, stored).data.items).toEqual([]);
  });

  it("checks names against the whole saved catalog, not only the rows sent", () => {
    const duplicate = form([["item::g1::i3::name", "vodka"], ["item::g1::i3::price", "1"]]);
    expect(parseDrinkGroupsForm(duplicate, stored).error).toBe(
      'Two items are both named "vodka". Give one a different name.',
    );
    // Removing the saved one in the same save frees the name.
    duplicate.append("deletedRow", "i:i1");
    expect(parseDrinkGroupsForm(duplicate, stored).ok).toBe(true);
  });

  it("deletes every saved item in a deleted group", () => {
    const result = parseDrinkGroupsForm(form([["deletedRow", "g:g1"], ["deletedRow", "i:i1"]]), stored);
    expect(result.data.deletedGroupIds).toEqual(["g1"]);
    expect(result.data.deletedItemIds.sort()).toEqual(["i1", "i2"]);
  });

  it("refuses an item for a group that was deleted", () => {
    const orphan = form([["item::gone::i9::name", "Gin"], ["item::gone::i9::price", "5"]]);
    expect(parseDrinkGroupsForm(orphan, stored).error).toBe(
      "That drink group was deleted. Reload the page to see the current catalog.",
    );
  });

  it("refuses a bad price, naming the item", () => {
    const bad = form([["group::g1::label", "L"], ["item::g1::i1::name", "Vodka"], ["item::g1::i1::price", "-3"]]);
    expect(parseDrinkGroupsForm(bad, empty).error).toBe("Vodka: A price can't be negative.");
  });
});

describe("parseDrinkPresetsForm", () => {
  it("keeps positive whole quantities, and lists every category sent even with none left", () => {
    const result = parseDrinkPresetsForm(
      form([["preset::mixer::vodka", "2"], ["preset::mixer::rum", "0"], ["preset::party::vodka", ""], ["other", "9"]]),
    );
    expect(result.data).toEqual({ mixer: { vodka: 2 }, party: {} });
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
