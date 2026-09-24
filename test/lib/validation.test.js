import { describe, it, expect } from "vitest";
import { z } from "zod";
import { check, dollars, isRealIsoDate, isRealYearMonth, isTime } from "@/lib/validation";

describe("date and time checks", () => {
  it("accepts real dates and months, and rejects impossible or malformed ones", () => {
    expect(isRealIsoDate("2026-02-28")).toBe(true);
    expect(isRealIsoDate("2028-02-29")).toBe(true);
    for (const bad of ["2026-02-29", "2026-02-30", "2026-13-01", "2026-9-01", "garbage", "", null, ["2026-09-01"], "1999-12-31", "2101-01-01"]) {
      expect(isRealIsoDate(bad)).toBe(false);
    }
    expect(isRealYearMonth("2026-09")).toBe(true);
    for (const bad of ["2026-13", "2026-00", "2026-9", "garbage", undefined]) {
      expect(isRealYearMonth(bad)).toBe(false);
    }
  });

  it("accepts 24-hour times only", () => {
    expect(isTime("00:00")).toBe(true);
    expect(isTime("23:59")).toBe(true);
    for (const bad of ["24:00", "7:30", "12:60", "7pm", ""]) expect(isTime(bad)).toBe(false);
  });
});

describe("dollars", () => {
  const optional = dollars("expected spend");
  const required = dollars("a budget", { required: true });

  it("turns dollar amounts into integer cents, and blank into null", () => {
    expect(optional.parse("123.45")).toBe(12345);
    expect(optional.parse("$1,250")).toBe(125000);
    expect(optional.parse(" 0 ")).toBe(0);
    expect(optional.parse("0.1")).toBe(10);
    expect(optional.parse("")).toBeNull();
  });

  it("refuses text, negatives, and amounts past $1,000,000 with a message naming the field", () => {
    expect(optional.safeParse("abc").error.issues[0].message).toBe("Expected spend must be a dollar amount.");
    expect(optional.safeParse("-5").error.issues[0].message).toBe("Expected spend can't be negative.");
    expect(optional.safeParse("1000000.01").success).toBe(false);
    expect(optional.safeParse("1000000").success).toBe(true);
  });

  it("refuses blank when required", () => {
    expect(required.safeParse("").error.issues[0].message).toBe("Enter a budget.");
  });
});

describe("check", () => {
  it("returns the data, or the first problem plus every field's first problem", () => {
    const schema = z.object({ a: z.string().min(1, "A is blank."), b: z.string().min(1, "B is blank.") });
    expect(check(schema, { a: "x", b: "y" })).toEqual({ ok: true, data: { a: "x", b: "y" } });
    expect(check(schema, { a: "", b: "" })).toEqual({
      ok: false,
      error: "A is blank.",
      fieldErrors: { a: "A is blank.", b: "B is blank." },
    });
  });
});
