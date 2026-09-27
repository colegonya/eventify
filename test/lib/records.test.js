import { describe, it, expect } from "vitest";
import {
  assembleDrinkGroups,
  bySortOrder,
  inSortOrder,
  splitDrinkGroups,
  withSortOrders,
} from "@/lib/records";

describe("inSortOrder", () => {
  it("orders a hash's records by sortOrder, then id, and reads a missing hash as empty", () => {
    const hash = { b: { id: "b", sortOrder: 1 }, c: { id: "c", sortOrder: 0 }, a: { id: "a", sortOrder: 1 } };
    expect(inSortOrder(hash).map((r) => r.id)).toEqual(["c", "a", "b"]);
    expect(inSortOrder(null)).toEqual([]);
  });

  it("puts a record with no sortOrder last", () => {
    expect([{ id: "x" }, { id: "y", sortOrder: 5 }].sort(bySortOrder).map((r) => r.id)).toEqual(["y", "x"]);
  });
});

describe("withSortOrders", () => {
  it("keeps an existing record's sortOrder and puts new ones after the last", () => {
    const existing = [
      { id: "a", sortOrder: 0 },
      { id: "b", sortOrder: 4 },
    ];
    const result = withSortOrders(existing, [{ id: "new1" }, { id: "a", name: "renamed" }, { id: "new2" }]);
    expect(result).toEqual([
      { id: "new1", sortOrder: 5 },
      { id: "a", name: "renamed", sortOrder: 0 },
      { id: "new2", sortOrder: 6 },
    ]);
  });
});

describe("drink catalog", () => {
  const groups = [
    { id: "beer", label: "Beer", items: [{ id: "lager", name: "Lager", price: 20 }] },
    {
      id: "wine",
      label: "Wine",
      items: [
        { id: "red", name: "Red", price: 15 },
        { id: "white", name: "White", price: 14 },
      ],
    },
  ];

  it("splits into group and item records and back again", () => {
    const { groupRecords, itemRecords } = splitDrinkGroups(groups);
    expect(groupRecords).toEqual([
      { id: "beer", label: "Beer", sortOrder: 0 },
      { id: "wine", label: "Wine", sortOrder: 1 },
    ]);
    expect(itemRecords.map((i) => [i.id, i.groupId, i.sortOrder])).toEqual([
      ["lager", "beer", 0],
      ["red", "wine", 1],
      ["white", "wine", 2],
    ]);

    const hash = (records) => Object.fromEntries(records.map((r) => [r.id, r]));
    expect(assembleDrinkGroups(hash(groupRecords), hash(itemRecords))).toEqual(groups);
  });

  it("leaves out an item whose group is gone", () => {
    const items = { orphan: { id: "orphan", groupId: "gone", name: "Gin", price: 5, sortOrder: 0 } };
    expect(assembleDrinkGroups({ beer: { id: "beer", label: "Beer", sortOrder: 0 } }, items)).toEqual([
      { id: "beer", label: "Beer", items: [] },
    ]);
  });
});
