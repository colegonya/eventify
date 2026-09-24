import { CONTACT_STATUSES } from "@/types/contact";
import { isHexColor } from "@/lib/color";
import { fail, fields, isRealIsoDate, LIMITS, ok } from "@/lib/validation";

// The rule every autosaving list editor follows: a row is deleted only by its
// Remove button, which takes it out of the form entirely. A row that's still
// in the form with its name cleared is an officer mid-retype, so a record
// that already exists is refused rather than dropped. A brand-new row that was
// never filled in is just an unused "add" row, and is skipped.

const tooMany = (what) => fail(`That's more ${what} than one list can hold (${LIMITS.rows}).`);

const validId = (id) => typeof id === "string" && id.length > 0 && id.length <= 100;

/**
 * Contacts for one semester. `existingIds` is every contact id already saved
 * for it.
 */
export function parseContactsForm(formData, semesterId, existingIds) {
  const ids = fields(formData, "contactId");
  const orgs = fields(formData, "contactOrg");
  const positions = fields(formData, "contactPosition");
  const statuses = fields(formData, "contactStatus");
  const phones = fields(formData, "contactPhone");
  const meetingDates = fields(formData, "contactMeetingDate");
  const notes = formData.getAll("contactNotes").map((v) => String(v ?? "").trim());
  if (ids.length > LIMITS.rows) return tooMany("contacts");

  const contacts = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const position = positions[i] ?? "";
    if (!validId(id)) return fail("A contact is missing its id. Reload the page and try again.");
    if (!position) {
      if (existingIds.has(id)) {
        return fail("A contact's name or role can't be blank. Use Remove to delete a contact.", {
          contactPosition: "blank",
        });
      }
      continue;
    }
    if (position.length > LIMITS.name || (orgs[i] ?? "").length > LIMITS.name) {
      return fail(`Contact names and orgs can be at most ${LIMITS.name} characters.`);
    }
    const status = statuses[i] || CONTACT_STATUSES[0];
    if (!CONTACT_STATUSES.includes(status)) return fail(`"${status}" isn't a contact status.`);
    const meetingDate = meetingDates[i] || null;
    if (meetingDate && !isRealIsoDate(meetingDate)) return fail("A meeting date isn't a real date.");
    if ((phones[i] ?? "").length > LIMITS.phone) return fail("A phone number is too long.");
    if ((notes[i] ?? "").length > LIMITS.notes) {
      return fail(`Contact notes can be at most ${LIMITS.notes} characters.`);
    }

    contacts.push({
      id,
      semesterId,
      org: orgs[i] ?? "",
      position,
      status,
      phone: phones[i] ?? "",
      meetingDate,
      notes: notes[i] ?? "",
    });
  }
  return ok(contacts);
}

/** The whole category list. `existingIds` is every category id already saved. */
export function parseCategoriesForm(formData, existingIds) {
  const ids = fields(formData, "categoryId");
  const labels = fields(formData, "categoryLabel");
  const colors = fields(formData, "categoryColor");
  const netsRevenueIds = new Set(fields(formData, "categoryNetsRevenue"));
  const excludeIds = new Set(fields(formData, "categoryExcludeFromBudgetTotal"));
  const otherOrgIds = new Set(fields(formData, "categoryIsOtherOrgCategory"));
  if (ids.length > LIMITS.rows) return tooMany("categories");

  const categories = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const label = labels[i] ?? "";
    if (!validId(id)) return fail("A category is missing its id. Reload the page and try again.");
    if (!label) {
      if (existingIds.has(id)) {
        return fail("A category needs a name. Use Remove to delete a category.", { categoryLabel: "blank" });
      }
      continue;
    }
    if (label.length > LIMITS.shortName) {
      return fail(`Category names can be at most ${LIMITS.shortName} characters.`);
    }
    const color = colors[i] ?? "";
    if (!isHexColor(color)) return fail(`Pick a color for "${label}".`, { categoryColor: "invalid" });

    categories.push({
      id,
      label,
      color,
      netsRevenue: netsRevenueIds.has(id),
      excludeFromBudgetTotal: excludeIds.has(id),
      isOtherOrgCategory: otherOrgIds.has(id),
    });
  }
  return ok(categories);
}

/** Calendar markers for one semester. `existingIds` is every marker id already saved. */
export function parseMarkersForm(formData, semesterId, existingIds) {
  const ids = fields(formData, "markerId");
  const dates = fields(formData, "markerDate");
  const labels = fields(formData, "markerLabel");
  if (ids.length > LIMITS.rows) return tooMany("markers");

  const markers = [];
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const date = dates[i] ?? "";
    const label = labels[i] ?? "";
    if (!validId(id)) return fail("A marker is missing its id. Reload the page and try again.");
    if (!date || !label) {
      if (existingIds.has(id)) {
        return fail("A marker needs both a date and a label. Use Remove to delete a marker.");
      }
      continue;
    }
    if (!isRealIsoDate(date)) return fail(`The date for "${label}" isn't a real date.`);
    if (label.length > LIMITS.name) return fail(`Marker labels can be at most ${LIMITS.name} characters.`);
    markers.push({ id, semesterId, date, label });
  }
  return ok(markers);
}
