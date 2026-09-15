import { describe, it, expect } from "vitest";
import {
  vocabulary,
  pluralize,
  DEFAULT_ORG_NOUN,
  DEFAULT_PERIOD_NOUN,
} from "@/lib/vocabulary";

describe("pluralize", () => {
  it("handles the words a time period is actually called", () => {
    expect(pluralize("Semester")).toBe("Semesters");
    expect(pluralize("Term")).toBe("Terms");
    expect(pluralize("Quarter")).toBe("Quarters");
    expect(pluralize("Fiscal Year")).toBe("Fiscal Years");
  });

  it("adds -es after a sibilant instead of an unsayable bare -s", () => {
    expect(pluralize("Class")).toBe("Classes");
    expect(pluralize("Session")).toBe("Sessions");
    expect(pluralize("Batch")).toBe("Batches");
    expect(pluralize("Push")).toBe("Pushes");
  });

  it("turns a consonant-plus-y into -ies, but leaves a vowel-plus-y alone", () => {
    expect(pluralize("Company")).toBe("Companies");
    expect(pluralize("Day")).toBe("Days");
  });
});

describe("vocabulary", () => {
  it("falls back to neutral defaults when a deployment has set nothing", () => {
    const v = vocabulary();

    expect(v.org).toBe(DEFAULT_ORG_NOUN);
    expect(v.period).toBe(DEFAULT_PERIOD_NOUN);
    expect(v.periodPlural).toBe("Semesters");
  });

  it("uses what the deployment chose", () => {
    const v = vocabulary({ orgNoun: "Chapter", periodNoun: "Term" });

    expect(v.org).toBe("Chapter");
    expect(v.period).toBe("Term");
    expect(v.periodPlural).toBe("Terms");
  });

  it("offers a lowercase form for mid-sentence copy", () => {
    const v = vocabulary({ orgNoun: "Chapter", periodNoun: "Fiscal Year" });

    expect(v.orgLower).toBe("chapter");
    expect(v.periodLower).toBe("fiscal year");
    expect(v.periodPluralLower).toBe("fiscal years");
  });

  it("ignores blank and whitespace-only values rather than rendering an empty label", () => {
    // A field cleared in Settings must fall back, not leave the UI saying
    // "Give your  a name."
    const v = vocabulary({ orgNoun: "   ", periodNoun: "" });

    expect(v.org).toBe(DEFAULT_ORG_NOUN);
    expect(v.period).toBe(DEFAULT_PERIOD_NOUN);
  });

  it("trims a value someone typed with a stray space", () => {
    expect(vocabulary({ orgNoun: "  Club  " }).org).toBe("Club");
  });
});
