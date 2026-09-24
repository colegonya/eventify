import { describe, it, expect } from "vitest";
import { parseCategoriesForm, parseContactsForm, parseMarkersForm } from "@/lib/forms/lists";

const rows = (keyed) => {
  const data = new FormData();
  for (const row of keyed) for (const [key, value] of Object.entries(row)) data.append(key, value);
  return data;
};

const contact = (id, position, extra = {}) => ({
  contactId: id,
  contactOrg: "Kappa",
  contactPosition: position,
  contactStatus: "Reached Out",
  contactPhone: "",
  contactMeetingDate: "",
  contactNotes: "",
  ...extra,
});

describe("parseContactsForm", () => {
  it("keeps filled rows and skips a brand-new row that was never filled in", () => {
    const result = parseContactsForm(rows([contact("c1", "Social Chair"), contact("new", "")]), "fall", new Set(["c1"]));
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([
      { id: "c1", semesterId: "fall", org: "Kappa", position: "Social Chair", status: "Reached Out", phone: "", meetingDate: null, notes: "" },
    ]);
  });

  it("refuses to save a saved contact whose name was cleared, instead of deleting it", () => {
    // This used to drop the contact on the next autosave: clearing a name to
    // retype it deleted the record if you paused for a second.
    const result = parseContactsForm(rows([contact("c1", "")]), "fall", new Set(["c1"]));
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/can't be blank. Use Remove/);
  });

  it("refuses an unknown status and a date that isn't real", () => {
    expect(parseContactsForm(rows([contact("c1", "A", { contactStatus: "Ghosted" })]), "fall", new Set()).error).toBe(
      '"Ghosted" isn\'t a contact status.',
    );
    expect(
      parseContactsForm(rows([contact("c1", "A", { contactMeetingDate: "2026-02-30" })]), "fall", new Set()).error,
    ).toBe("A meeting date isn't a real date.");
  });
});

const category = (id, label, color = "#3b82f6") => ({ categoryId: id, categoryLabel: label, categoryColor: color });

describe("parseCategoriesForm", () => {
  it("reads rows and their checkboxes", () => {
    const data = rows([category("mixer", "Mixer"), category("philo", "Philanthropy")]);
    data.append("categoryNetsRevenue", "philo");
    const result = parseCategoriesForm(data, new Set(["mixer", "philo"]));
    expect(result.data).toEqual([
      { id: "mixer", label: "Mixer", color: "#3b82f6", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
      { id: "philo", label: "Philanthropy", color: "#3b82f6", netsRevenue: true, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
    ]);
  });

  it("refuses a cleared name on a saved category, and skips an unused new row", () => {
    expect(parseCategoriesForm(rows([category("mixer", "")]), new Set(["mixer"])).error).toBe(
      "A category needs a name. Use Remove to delete a category.",
    );
    expect(parseCategoriesForm(rows([category("new", "")]), new Set()).data).toEqual([]);
  });

  it("refuses a color that isn't a hex code", () => {
    expect(parseCategoriesForm(rows([category("mixer", "Mixer", "red")]), new Set()).error).toBe('Pick a color for "Mixer".');
  });
});

const marker = (id, date, label) => ({ markerId: id, markerDate: date, markerLabel: label });

describe("parseMarkersForm", () => {
  it("pairs rows into markers stamped with the semester", () => {
    expect(parseMarkersForm(rows([marker("m1", "2026-10-11", "Homecoming")]), "fall", new Set()).data).toEqual([
      { id: "m1", semesterId: "fall", date: "2026-10-11", label: "Homecoming" },
    ]);
  });

  it("skips a half-filled new row but refuses to drop a saved marker", () => {
    expect(parseMarkersForm(rows([marker("new", "", "Finals")]), "fall", new Set()).data).toEqual([]);
    expect(parseMarkersForm(rows([marker("m1", "", "Finals")]), "fall", new Set(["m1"])).ok).toBe(false);
  });

  it("refuses a date that isn't real", () => {
    expect(parseMarkersForm(rows([marker("m1", "2026-13-01", "Finals")]), "fall", new Set()).error).toBe(
      'The date for "Finals" isn\'t a real date.',
    );
  });
});
