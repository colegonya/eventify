/**
 * Dollar-string to cents conversion, in one place.
 *
 * There are deliberately two parsers here, not one. They disagree about what
 * an empty or unparseable field means, and both answers are right in context:
 *
 * - The forms need a number to do live arithmetic with while someone is still
 *   typing, so a half-finished field reads as 0 rather than blanking the
 *   running total under the cursor.
 * - A submitted form needs to tell "they left it blank" apart from "they meant
 *   zero", because a null expected-spend is what marks an event as having no
 *   budget figure entered at all.
 *
 * Keeping them adjacent is the point: the split is a decision, and it used to
 * be invisible, with one copy inside a "use server" file and two more
 * hand-copied into components.
 */

/** Cents to the string a dollar input shows. Null means an empty field. */
export function centsToDollarsInput(cents) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

/** For live form math: anything unparseable counts as 0. */
export function dollarsToCents(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/** For submitted values: blank or unparseable stays null, never a silent 0. */
export function parseDollarsToCents(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const dollars = Number.parseFloat(value);
  if (Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}
