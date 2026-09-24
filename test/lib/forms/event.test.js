import { describe, it, expect } from "vitest";
import { parseEventForm } from "@/lib/forms/event";

const form = (fields, lineItems = []) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  for (const [name, amount] of lineItems) {
    data.append("actualSpendName", name);
    data.append("actualSpendAmount", amount);
  }
  return data;
};

const categories = new Set(["mixer", "other-org"]);
const valid = { name: "Welcome Mixer", category: "mixer", host: "Pike", startDate: "2026-09-03", status: "confirmed" };

describe("parseEventForm", () => {
  it("returns a complete event for a valid form, defaulting the end date to the start", () => {
    const result = parseEventForm(
      form({ ...valid, expectedSpend: "700", hostShareFraction: "50", revenue: "", startTime: "19:30", notes: "  bring cups " }, [
        ["DJ deposit", "150.50"],
        ["", ""],
      ]),
      categories,
    );
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({
      name: "Welcome Mixer",
      category: "mixer",
      startDate: "2026-09-03",
      endDate: "2026-09-03",
      startTime: "19:30",
      endTime: null,
      status: "confirmed",
      expectedSpendCents: 70000,
      expectedSpendApproval: "pending",
      hostShareFraction: 0.5,
      revenueCents: null,
      notes: "bring cups",
    });
    expect(result.data.actualSpend).toEqual([{ id: expect.any(String), name: "DJ deposit", amountCents: 15050 }]);
  });

  it("refuses an end date before the start date, naming the field", () => {
    const result = parseEventForm(form({ ...valid, endDate: "2026-09-01" }), categories);
    expect(result).toMatchObject({ ok: false, error: "The end date can't be before the start date." });
    expect(result.fieldErrors.endDate).toBeDefined();
  });

  it("refuses a category that doesn't exist, with a different message when there are none", () => {
    expect(parseEventForm(form({ ...valid, category: "deleted" }), categories).error).toBe("Pick a category.");
    expect(parseEventForm(form(valid), new Set()).error).toMatch(/Add a category/);
  });

  it("refuses each kind of bad field with a message about that field", () => {
    const cases = [
      [{ name: "   " }, "The event name can't be blank."],
      [{ name: "x".repeat(121) }, "The event name can be at most 120 characters."],
      [{ startDate: "2026-02-30" }, "Pick a start date."],
      [{ startTime: "7pm" }, "Start time must be a time like 19:30."],
      [{ status: "maybe" }, "Status must be Confirmed or Tentative."],
      [{ expectedSpend: "lots" }, "Expected spend must be a dollar amount."],
      [{ revenue: "-1" }, "Revenue can't be negative."],
      [{ hostShareFraction: "150" }, "Host's share must be a percentage from 0 to 100."],
    ];
    for (const [change, message] of cases) {
      expect(parseEventForm(form({ ...valid, ...change }), categories).error).toBe(message);
    }
  });

  it("refuses a half-filled actual-spend line instead of dropping it", () => {
    expect(parseEventForm(form(valid, [["Photobooth", ""]]), categories).error).toBe(
      'Add an amount for "Photobooth", or remove that line.',
    );
    expect(parseEventForm(form(valid, [["", "40"]]), categories).error).toBe("Every actual-spend line needs a name.");
    expect(parseEventForm(form(valid, [["Cups", "abc"]]), categories).error).toBe("Each amount must be a dollar amount.");
  });
});
