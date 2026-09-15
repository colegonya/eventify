import { parseDollarsToCents } from "@/lib/money";

/**
 * Semester ids show up in URLs (?semester=...) and Redis keys, so they're
 * slugs of the label rather than UUIDs — easier to read when something needs
 * debugging. Uniqueness is enforced against the existing list, since two
 * semesters sharing an id would share their events.
 */
export function semesterIdFromLabel(label, existingIds) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "semester";
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Returns an error code instead of throwing: Next redacts thrown server-action
 * messages in production, so a throw would show the exec board a generic
 * "something went wrong" instead of what they actually got wrong. The caller
 * redirects back with ?error=<code>, the same pattern loginAction uses.
 */
export function parseSemesterFields(formData) {
  const label = String(formData.get("label") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!label) return { error: "name" };
  if (!startDate || !endDate) return { error: "dates" };
  if (endDate < startDate) return { error: "order" };

  return {
    fields: {
      label,
      startDate,
      endDate,
      maxBudgetCents: parseDollarsToCents(formData.get("maxBudget")) ?? 0,
    },
  };
}
