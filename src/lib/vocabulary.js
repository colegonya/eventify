// What this deployment calls itself and calls a stretch of time.
//
// The app was built for one fraternity chapter, so "Chapter" and "Semester"
// were written into the copy as though they were universal. They aren't: a
// non-profit board thinks in fiscal years, a student government in terms, a
// company ERG in quarters and has no "chapter" at all. Both words are now
// data, the same way the org's name and colors already were.
//
// The defaults are neutral rather than Greek. A chapter that wants its own
// word sets it once in Settings; a robotics club that never thinks about it
// gets copy that already reads correctly.
export const DEFAULT_ORG_NOUN = "Organization";
export const DEFAULT_PERIOD_NOUN = "Semester";

const clean = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * English plural for a noun an officer typed. Covers the shapes a time period
 * actually takes — Semester, Term, Quarter, Year, Session, Cycle, Class — and
 * degrades to a trailing "s" for anything else, which is wrong far less often
 * than hardcoding "Semesters" was.
 */
export function pluralize(noun) {
  if (/[sxz]$/i.test(noun) || /(ch|sh)$/i.test(noun)) return `${noun}es`;
  // Consonant + y: Company -> Companies, but Day -> Days.
  if (/[^aeiou]y$/i.test(noun)) return `${noun.slice(0, -1)}ies`;
  return `${noun}s`;
}

/**
 * Resolves the stored nouns into every form the UI needs, so no caller has to
 * remember whether it wants a plural or a mid-sentence lowercase.
 */
export function vocabulary(settings = {}) {
  const org = clean(settings.orgNoun) || DEFAULT_ORG_NOUN;
  const period = clean(settings.periodNoun) || DEFAULT_PERIOD_NOUN;
  const periodPlural = pluralize(period);

  return {
    org,
    orgLower: org.toLowerCase(),
    period,
    periodLower: period.toLowerCase(),
    periodPlural,
    periodPluralLower: periodPlural.toLowerCase(),
  };
}
