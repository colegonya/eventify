import { describe, it, expect } from "vitest";
import { buildCalendarHref, readCalendarParams } from "@/lib/calendarUrl";

const params = (query) => new URLSearchParams(query);

describe("buildCalendarHref", () => {
  it("carries the current calendar params through untouched", () => {
    const href = buildCalendarHref(params("semester=fall-2026&month=2026-09"), {});

    expect(href).toBe("/calendar?semester=fall-2026&month=2026-09");
  });

  it("drops params that don't belong to the calendar", () => {
    // Otherwise a stray ?error= or ?saved= from another page would ride along
    // through every month click.
    const href = buildCalendarHref(params("semester=fall-2026&error=1&utm_source=x"), {});

    expect(href).toBe("/calendar?semester=fall-2026");
  });

  it("applies a patch over the current value", () => {
    const href = buildCalendarHref(params("month=2026-09"), { month: "2026-10" });

    expect(href).toBe("/calendar?month=2026-10");
  });

  it("removes a param patched to null", () => {
    const href = buildCalendarHref(params("month=2026-09&event=e1"), { event: null });

    expect(href).toBe("/calendar?month=2026-09");
  });

  it("closes an open editor whenever navigation happens", () => {
    // Changing month with the editor open must not carry ?event= along, or
    // the dialog reopens over a month that may not even contain that event.
    const href = buildCalendarHref(params("month=2026-09&event=e1&date=2026-09-05"), {
      month: "2026-10",
    });

    expect(href).toBe("/calendar?month=2026-10");
  });

  it("keeps editor params when the patch only touches the editor", () => {
    const href = buildCalendarHref(params("semester=fall-2026"), { new: "1", date: "2026-09-05" });

    expect(href).toBe("/calendar?semester=fall-2026&new=1&date=2026-09-05");
  });

  it("ignores editor values in the patch when navigating at the same time", () => {
    // Nav wins outright: the rule is about discarding an in-progress edit, so
    // an event id arriving alongside a month change is dropped too.
    const href = buildCalendarHref(params(""), { month: "2026-10", event: "e1" });

    expect(href).toBe("/calendar?month=2026-10");
  });

  it("returns the bare path when nothing is left to encode", () => {
    expect(buildCalendarHref(params(""), {})).toBe("/calendar");
  });
});

describe("readCalendarParams", () => {
  it("uses valid params as given", () => {
    expect(readCalendarParams({ view: "week", month: "2026-10", week: "2026-10-14" }, "2026-09")).toEqual({
      view: "week",
      month: "2026-10",
      week: "2026-10-14",
    });
  });

  it("falls back to the defaults for anything unusable instead of breaking the page", () => {
    // ?month=garbage rendered "undefined NaN"; ?week=nope crashed the page.
    expect(readCalendarParams({ month: "garbage", week: "nope", view: "sideways" }, "2026-09")).toEqual({
      view: "month",
      month: "2026-09",
      week: "2026-09-01",
    });
    expect(readCalendarParams({ month: "2026-13" }, "2026-09").month).toBe("2026-09");
    expect(readCalendarParams({ month: ["2026-10", "2026-11"] }, "2026-09").month).toBe("2026-09");
  });
});
