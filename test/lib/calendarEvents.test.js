import { describe, it, expect } from "vitest";
import { compareByStartTime, shiftEvent } from "@/lib/calendarEvents";

describe("compareByStartTime", () => {
  it("orders by start time, with day-only events last", () => {
    const events = [{ startTime: null }, { startTime: "19:00" }, { startTime: "09:30" }, { startTime: null }];
    expect(events.sort(compareByStartTime).map((e) => e.startTime)).toEqual(["09:30", "19:00", null, null]);
  });
});

describe("shiftEvent", () => {
  it("moves both ends by the same number of days, across a month", () => {
    const event = { id: "a", name: "Formal", startDate: "2026-09-29", endDate: "2026-10-01" };
    expect(shiftEvent(event, 3)).toEqual({ id: "a", name: "Formal", startDate: "2026-10-02", endDate: "2026-10-04" });
  });

  it("moves backward too, and leaves the original alone", () => {
    const event = { startDate: "2026-03-01", endDate: "2026-03-01" };
    expect(shiftEvent(event, -1)).toEqual({ startDate: "2026-02-28", endDate: "2026-02-28" });
    expect(event.startDate).toBe("2026-03-01");
  });
});
