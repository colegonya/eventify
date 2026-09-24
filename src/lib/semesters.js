import { dollars, isRealIsoDate, LIMITS } from "@/lib/validation";

const requiredBudget = dollars("a budget", { required: true });

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
 *
 * The budget is required. A blank one used to save as a $0 cap, which reads
 * as "already over budget" on the first dollar spent.
 */
export function parseSemesterFields(formData) {
  const label = String(formData.get("label") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!label) return { error: "name" };
  if (label.length > LIMITS.shortName) return { error: "nameLength" };
  if (!isRealIsoDate(startDate) || !isRealIsoDate(endDate)) return { error: "dates" };
  if (endDate < startDate) return { error: "order" };

  const budget = requiredBudget.safeParse(String(formData.get("maxBudget") ?? ""));
  if (!budget.success) return { error: "budget" };

  return { fields: { label, startDate, endDate, maxBudgetCents: budget.data } };
}

/** The Budget page's cap field alone: cents, or null when it isn't a usable amount. */
export function parseMaxBudget(value) {
  const budget = requiredBudget.safeParse(String(value ?? ""));
  return budget.success ? budget.data : null;
}
