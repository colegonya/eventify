import { describe, it, expect } from "vitest";
import { parseEquipmentForm } from "@/lib/forms/equipment";

const form = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};

describe("parseEquipmentForm", () => {
  it("returns a complete item for a valid form", () => {
    const result = parseEquipmentForm(
      form({ name: "Speaker", priority: "2", expectedCost: "300", expectedCostApproved: "on", link: "https://example.com/speaker" }),
    );
    expect(result).toEqual({
      ok: true,
      data: {
        name: "Speaker",
        priority: 2,
        expectedCostCents: 30000,
        expectedCostApproval: "approved",
        actualSpend: [],
        link: "https://example.com/speaker",
        notes: "",
      },
    });
  });

  it("only accepts web links, since the Budget page renders them as links", () => {
    for (const link of ["javascript:alert(1)", "data:text/html,hi", "example.com", "ftp://example.com"]) {
      expect(parseEquipmentForm(form({ name: "Speaker", link })).error).toBe(
        "The link must start with http:// or https://.",
      );
    }
    expect(parseEquipmentForm(form({ name: "Speaker", link: "" })).ok).toBe(true);
  });

  it("refuses a blank name and an out-of-range priority", () => {
    expect(parseEquipmentForm(form({ name: "" })).error).toBe("The item name can't be blank.");
    expect(parseEquipmentForm(form({ name: "Speaker", priority: "-1" })).error).toMatch(/Priority/);
    expect(parseEquipmentForm(form({ name: "Speaker", priority: "1000" })).error).toMatch(/Priority/);
  });
});
