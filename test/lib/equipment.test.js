import { describe, it, expect } from "vitest";
import { equipmentItemsForSemester } from "@/lib/equipment";

const item = (overrides) => ({
  id: "i1",
  name: "Speaker",
  purchasedSemesterId: null,
  ...overrides,
});

describe("equipmentItemsForSemester", () => {
  it("carries an unbought wishlist item into every semester", () => {
    // A null purchase semester is the whole carry-forward mechanic: the item
    // keeps showing up each term until someone actually buys it.
    const items = [item({ id: "wishlist" })];

    expect(equipmentItemsForSemester(items, "fall-2026").map((i) => i.id)).toEqual(["wishlist"]);
    expect(equipmentItemsForSemester(items, "spring-2027").map((i) => i.id)).toEqual(["wishlist"]);
  });

  it("shows a purchased item only against the semester that paid for it", () => {
    const items = [item({ id: "bought", purchasedSemesterId: "fall-2026" })];

    expect(equipmentItemsForSemester(items, "fall-2026").map((i) => i.id)).toEqual(["bought"]);
    // Otherwise last term's couch would keep counting against this term's cap.
    expect(equipmentItemsForSemester(items, "spring-2027")).toEqual([]);
  });

  it("mixes wishlist and this-semester purchases, leaving other terms out", () => {
    const items = [
      item({ id: "wishlist" }),
      item({ id: "bought-now", purchasedSemesterId: "fall-2026" }),
      item({ id: "bought-before", purchasedSemesterId: "spring-2026" }),
    ];

    expect(equipmentItemsForSemester(items, "fall-2026").map((i) => i.id)).toEqual([
      "wishlist",
      "bought-now",
    ]);
  });

  it("returns nothing for an empty list", () => {
    expect(equipmentItemsForSemester([], "fall-2026")).toEqual([]);
  });
});
