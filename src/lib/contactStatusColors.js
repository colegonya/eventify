
export const CONTACT_STATUS_STYLES = {
  "Not Reached Out": "bg-red-700 text-white",
  // Fixed amber, not the chapter's accent: per the Fixed-Severity Rule these
  // three are semantic red/amber/green independent of the brand palette, since
  // a chapter's own colors might contain nothing that reads as "in progress".
  // Full opacity too — at bg-brand-accent/45 this rendered as a washed tan
  // beside two saturated siblings, exactly the "lighter/lesser" read the
  // Status Pill spec forbids. Matches CONFLICT_STYLES.warning (#f59e0b).
  "Reached Out": "bg-amber-500 text-slate-800",
  "Responded/Meeting Set": "bg-green-600 text-white",
};
