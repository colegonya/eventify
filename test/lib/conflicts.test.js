import { describe, it, expect } from "vitest";
import { computeConflicts } from "@/lib/conflicts";

const event = (overrides) => ({
  startDate: "2026-10-30",
  endDate: "2026-10-30",
  startTime: null,
  endTime: null,
  host: "Pike",
  ...overrides,
});

describe("computeConflicts", () => {
  it("rates an overlap between two of the chapter's own events as major", () => {
    const events = [
      event({ id: "a", startTime: "21:00" }),
      event({ id: "b", startTime: "22:00" }),
      event({ id: "theirs", startTime: "21:30", host: "Fiji" }),
    ];

    const conflicts = computeConflicts(events, "Pike");

    expect(conflicts.get("a")).toContainEqual({ otherEventId: "b", severity: "major" });
    expect(conflicts.get("a")).toContainEqual({ otherEventId: "theirs", severity: "warning" });
  });

  it("treats an end time at or before the start as running past midnight, not backwards", () => {
    const events = [
      event({ id: "party", startTime: "22:00", endTime: "00:00" }),
      event({ id: "afters", startTime: "23:00" }),
    ];

    const conflicts = computeConflicts(events, "Pike");

    // Without the past-midnight rollover the first event's interval collapses and
    // the overlap goes undetected entirely.
    expect(conflicts.get("party")).toContainEqual({ otherEventId: "afters", severity: "major" });
  });

  it("ignores day-only events, which carry no time to compare", () => {
    const events = [event({ id: "a" }), event({ id: "b" })];

    expect(computeConflicts(events, "Pike").size).toBe(0);
  });
});
