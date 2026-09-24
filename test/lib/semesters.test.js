import { describe, it, expect } from "vitest";
import { semesterIdFromLabel, parseSemesterFields } from "@/lib/semesters";

const formData = (fields) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
};

describe("semesterIdFromLabel", () => {
  it("slugs a label into something readable in a URL", () => {
    expect(semesterIdFromLabel("Fall 2026", new Set())).toBe("fall-2026");
  });

  it("collapses punctuation and trims stray separators", () => {
    expect(semesterIdFromLabel("  Spring/Summer '27!  ", new Set())).toBe("spring-summer-27");
  });

  it("falls back to a usable id when the label has nothing to slug", () => {
    expect(semesterIdFromLabel("!!!", new Set())).toBe("semester");
  });

  it("suffixes a duplicate rather than colliding", () => {
    // Two semesters sharing an id would share their events, since the id is
    // the Redis key. This is the guard against silently merging two terms.
    expect(semesterIdFromLabel("Fall 2026", new Set(["fall-2026"]))).toBe("fall-2026-2");
  });

  it("keeps counting past the first taken suffix", () => {
    const taken = new Set(["fall-2026", "fall-2026-2", "fall-2026-3"]);

    expect(semesterIdFromLabel("Fall 2026", taken)).toBe("fall-2026-4");
  });
});

describe("parseSemesterFields", () => {
  const valid = { label: "Fall 2026", startDate: "2026-08-24", endDate: "2026-12-12", maxBudget: "10000" };

  it("returns the parsed fields for a complete form", () => {
    const result = parseSemesterFields(formData({ ...valid, maxBudget: "10000" }));

    expect(result.error).toBeUndefined();
    expect(result.fields).toEqual({
      label: "Fall 2026",
      startDate: "2026-08-24",
      endDate: "2026-12-12",
      maxBudgetCents: 1000000,
    });
  });

  it("refuses a blank or unusable budget instead of saving a $0 cap", () => {
    // This used to default to 0, which made every term read as over budget on
    // the first dollar spent.
    for (const maxBudget of ["", "   ", "abc", "-50"]) {
      expect(parseSemesterFields(formData({ ...valid, maxBudget })).error).toBe("budget");
    }
    expect(parseSemesterFields(formData({ ...valid, maxBudget: "0" })).fields.maxBudgetCents).toBe(0);
  });

  it("refuses dates that aren't real, and names that are too long", () => {
    expect(parseSemesterFields(formData({ ...valid, startDate: "2026-02-30" })).error).toBe("dates");
    expect(parseSemesterFields(formData({ ...valid, endDate: "someday" })).error).toBe("dates");
    expect(parseSemesterFields(formData({ ...valid, label: "x".repeat(61) })).error).toBe("nameLength");
  });

  it("names which field was wrong instead of throwing", () => {
    // Next redacts thrown server-action messages in production, so an error
    // code is what lets the page say something more useful than "went wrong".
    expect(parseSemesterFields(formData({ ...valid, label: "   " })).error).toBe("name");
    expect(parseSemesterFields(formData({ ...valid, startDate: "" })).error).toBe("dates");
    expect(parseSemesterFields(formData({ ...valid, endDate: "" })).error).toBe("dates");
  });

  it("rejects a term that ends before it starts", () => {
    const result = parseSemesterFields(
      formData({ ...valid, startDate: "2026-12-12", endDate: "2026-08-24" }),
    );

    expect(result.error).toBe("order");
    expect(result.fields).toBeUndefined();
  });

  it("accepts a single-day term", () => {
    const result = parseSemesterFields(
      formData({ ...valid, startDate: "2026-08-24", endDate: "2026-08-24" }),
    );

    expect(result.error).toBeUndefined();
  });

  it("trims surrounding whitespace off the label it stores", () => {
    expect(parseSemesterFields(formData({ ...valid, label: "  Fall 2026  " })).fields.label).toBe(
      "Fall 2026",
    );
  });
});
