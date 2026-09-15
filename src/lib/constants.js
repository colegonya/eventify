// Conflict severity overrides a category's color entirely, and equipment
// isn't a category at all — both get fixed colors independent of whatever
// palette a chapter picks for their own categories.
export const CONFLICT_STYLES = {
  major: { background: "#dc2626", color: "#ffffff" },
  warning: { background: "#f59e0b", color: "#1e293b" },
};

// What each severity actually means, in the officer's words rather than the
// code's. The chip tooltip and the calendar legend both read from here so the
// key and the thing it explains can't drift into describing red two ways.
export const CONFLICT_LABELS = {
  major: "Double-booked with your own event",
  warning: "Overlaps an event you don't host",
};

export const EQUIPMENT_COLOR = "#0ea5e9";
