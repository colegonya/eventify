import { z } from "zod";
import { isRealIsoDate, isRealYearMonth, isTime } from "@/lib/dates";

export { isRealIsoDate, isRealYearMonth, isTime };

// What every server action called from client code returns. Thrown errors
// don't work for this: Next.js replaces a thrown server-action message with a
// generic one in production, so the officer never learns what to fix.
//   { ok: true, data? }  or  { ok: false, error, fieldErrors }
export const ok = (data) => ({ ok: true, data });
export const fail = (error, fieldErrors = {}) => ({ ok: false, error, fieldErrors });

export const LIMITS = {
  name: 120,
  shortName: 60,
  notes: 2000,
  phone: 30,
  url: 500,
  lineItems: 50,
  rows: 500,
  // $1,000,000. Past this it's a typo, not a budget.
  maxCents: 100_000_000,
};

/** FormData values as trimmed strings; a missing field is "". */
export const field = (formData, name) => String(formData.get(name) ?? "").trim();
export const fields = (formData, name) => formData.getAll(name).map((v) => String(v ?? "").trim());

export const requiredText = (label, max = LIMITS.name) =>
  z
    .string()
    .trim()
    .min(1, `${label} can't be blank.`)
    .max(max, `${label} can be at most ${max} characters.`);

export const optionalText = (label, max) =>
  z.string().trim().max(max, `${label} can be at most ${max} characters.`);

export const isoDate = (message) => z.string().trim().refine(isRealIsoDate, message);

/**
 * Dollars as typed into a form, to integer cents. Blank is null ("not
 * entered"), which the budget math treats differently from zero, unless the
 * field is required.
 */
export function dollars(label, { required = false } = {}) {
  return z
    .string()
    .trim()
    .transform((raw, ctx) => {
      if (raw === "") {
        if (required) ctx.addIssue({ code: "custom", message: `Enter ${label}.` });
        return null;
      }
      const cleaned = raw.replace(/[$,]/g, "");
      if (!/^-?\d*(\.\d+)?$/.test(cleaned) || cleaned === "" || cleaned === "-") {
        ctx.addIssue({ code: "custom", message: `${capitalize(label)} must be a dollar amount.` });
        return z.NEVER;
      }
      const cents = Math.round(Number.parseFloat(cleaned) * 100);
      if (cents < 0) {
        ctx.addIssue({ code: "custom", message: `${capitalize(label)} can't be negative.` });
        return z.NEVER;
      }
      if (cents > LIMITS.maxCents) {
        ctx.addIssue({ code: "custom", message: `${capitalize(label)} can be at most $1,000,000.` });
        return z.NEVER;
      }
      return cents;
    });
}

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Runs a zod schema and converts a failure into the action result shape: the
 * first problem as the headline, and every field's first problem by name.
 */
export function check(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return ok(result.data);
  const fieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    fieldErrors[key] ??= issue.message;
  }
  return fail(result.error.issues[0].message, fieldErrors);
}
