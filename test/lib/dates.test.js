import { describe, it, expect } from "vitest";
import {
  parseISODate,
  formatISODate,
  addDays,
  daysBetween,
  shiftYearMonth,
  monthLabel,
  getMonthGridDates,
  getWeekGridDates,
  shiftWeek,
  weekLabel,
  isSameMonth,
  isToday,
  eventDatesInRange,
  isValidTimeZone,
  todayInTimeZone,
} from "@/lib/dates";

describe("ISO parsing and formatting", () => {
  it("round-trips a date without drifting across a timezone offset", () => {
    // Everything here is anchored at UTC midnight on purpose. Parsing as local
    // time would shift the date by a day for anyone west of Greenwich, which
    // is the classic off-by-one that puts an event on the wrong calendar cell.
    expect(formatISODate(parseISODate("2026-10-24"))).toBe("2026-10-24");
    expect(parseISODate("2026-10-24").toISOString()).toBe("2026-10-24T00:00:00.000Z");
  });

  it("crosses a DST boundary without losing or gaining a day", () => {
    // US DST ends 2026-11-01. Fixed 86400000ms steps over UTC have no wall
    // clock to skip, so this is a plain three-day walk.
    expect(formatISODate(addDays(parseISODate("2026-10-31"), 3))).toBe("2026-11-03");
  });

  it("counts whole days between dates, negatively when the range runs backwards", () => {
    expect(daysBetween("2026-09-02", "2026-09-14")).toBe(12);
    expect(daysBetween("2026-09-14", "2026-09-14")).toBe(0);
    expect(daysBetween("2026-09-20", "2026-09-14")).toBe(-6);
    expect(daysBetween("2026-12-28", "2027-01-04")).toBe(7);
  });
});

describe("shiftYearMonth", () => {
  it("rolls forward and back across a year boundary", () => {
    expect(shiftYearMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftYearMonth("2026-01", -1)).toBe("2025-12");
  });

  it("stays put at a delta of zero and handles multi-year jumps", () => {
    expect(shiftYearMonth("2026-08", 0)).toBe("2026-08");
    expect(shiftYearMonth("2026-08", 12)).toBe("2027-08");
    expect(shiftYearMonth("2026-08", -20)).toBe("2024-12");
  });

  it("labels a month for display", () => {
    expect(monthLabel("2026-09")).toBe("September 2026");
  });
});

describe("getMonthGridDates", () => {
  it("pads a month out to whole Sun-Sat weeks", () => {
    // September 2026 starts on a Tuesday, so the grid opens on Aug 30.
    const dates = getMonthGridDates("2026-09");

    expect(formatISODate(dates[0])).toBe("2026-08-30");
    expect(dates[0].getUTCDay()).toBe(0);
    expect(dates[dates.length - 1].getUTCDay()).toBe(6);
    expect(dates.length % 7).toBe(0);
  });

  it("adds no padding to a month that already fills its weeks", () => {
    // February 2026 runs Sun Feb 1 through Sat Feb 28: exactly four weeks.
    const dates = getMonthGridDates("2026-02");

    expect(dates.length).toBe(28);
    expect(formatISODate(dates[0])).toBe("2026-02-01");
    expect(formatISODate(dates[27])).toBe("2026-02-28");
  });
});

describe("week grids", () => {
  it("returns the Sun-Sat week containing a date", () => {
    const dates = getWeekGridDates("2026-09-16");

    expect(dates.length).toBe(7);
    expect(formatISODate(dates[0])).toBe("2026-09-13");
    expect(formatISODate(dates[6])).toBe("2026-09-19");
  });

  it("shifts by whole weeks", () => {
    expect(shiftWeek("2026-09-16", 1)).toBe("2026-09-23");
    expect(shiftWeek("2026-09-16", -2)).toBe("2026-09-02");
  });

  it("labels a week, spelling out the parts that actually change", () => {
    expect(weekLabel("2026-09-16")).toBe("Sep 13 - 19, 2026");
    expect(weekLabel("2026-10-01")).toBe("Sep 27 - Oct 3, 2026");
    expect(weekLabel("2026-12-31")).toBe("Dec 27, 2026 - Jan 2, 2027");
  });
});

describe("calendar cell predicates", () => {
  it("tells an in-month date from a padded neighbour", () => {
    expect(isSameMonth(parseISODate("2026-09-01"), "2026-09")).toBe(true);
    expect(isSameMonth(parseISODate("2026-08-31"), "2026-09")).toBe(false);
  });

  it("compares a grid date against today's date string", () => {
    expect(isToday(parseISODate("2026-09-14"), "2026-09-14")).toBe(true);
    expect(isToday(parseISODate("2026-09-15"), "2026-09-14")).toBe(false);
  });
});

describe("eventDatesInRange", () => {
  it("lists every day a multi-day event touches, inclusive of both ends", () => {
    expect(eventDatesInRange("2026-10-30", "2026-11-01")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
  });

  it("returns the single day for an event that starts and ends together", () => {
    expect(eventDatesInRange("2026-10-24", "2026-10-24")).toEqual(["2026-10-24"]);
  });

  it("returns nothing when the range runs backwards", () => {
    expect(eventDatesInRange("2026-10-24", "2026-10-23")).toEqual([]);
  });
});

describe("todayInTimeZone", () => {
  // 5:25pm on Sept 23 in Los Angeles, 8:25pm in New York, already the 24th in UTC.
  const evening = new Date("2026-09-24T00:25:00Z");

  it("gives the organization's date, not the server's UTC date", () => {
    expect(todayInTimeZone("America/Los_Angeles", evening)).toBe("2026-09-23");
    expect(todayInTimeZone("America/New_York", evening)).toBe("2026-09-23");
    expect(todayInTimeZone("UTC", evening)).toBe("2026-09-24");
    expect(todayInTimeZone("Asia/Tokyo", evening)).toBe("2026-09-24");
  });

  it("follows daylight saving time", () => {
    // Pacific is UTC-8 in winter and UTC-7 in summer.
    expect(todayInTimeZone("America/Los_Angeles", new Date("2026-01-15T07:30:00Z"))).toBe("2026-01-14");
    expect(todayInTimeZone("America/Los_Angeles", new Date("2026-07-15T07:30:00Z"))).toBe("2026-07-15");
  });

  it("turns over the month on the right evening", () => {
    // 9pm Pacific on Sept 30 is Oct 1 in UTC; the calendar must still open on September.
    expect(todayInTimeZone("America/Los_Angeles", new Date("2026-10-01T04:00:00Z"))).toBe("2026-09-30");
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA zone names and rejects anything else", () => {
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    for (const bad of ["PST-ish", "Mars/Olympus", "", undefined, 42]) expect(isValidTimeZone(bad)).toBe(false);
  });
});
