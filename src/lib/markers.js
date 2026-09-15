// Dated notes that sit on the calendar without being events: a rivalry game,
// finals week, a board retreat, move-in day. They carry no budget, no host and
// no conflict detection — they're context for planning around, which is why
// they aren't just events with a category.
//
// These shipped as "game days" with an `opponent` field, which assumed the
// deployment was a college chapter that plays football. The stored shape is
// now a free-text label, and normalizeMarker() still reads the old field, so
// records written before this keep rendering with nothing migrated.

const clean = (value) => (typeof value === "string" ? value.trim() : "");

/**
 * Reads one stored marker in either shape. An old record's `opponent` becomes
 * the label it was already being displayed as ("vs. Rival State"), so the
 * calendar looks identical before and after, and the first edit through the
 * editor quietly writes the new shape.
 */
export function normalizeMarker(raw) {
  const label = clean(raw.label) || (clean(raw.opponent) ? `vs. ${clean(raw.opponent)}` : "");
  return { id: raw.id, semesterId: raw.semesterId, date: raw.date, label };
}

export function normalizeMarkers(rawList) {
  return (rawList ?? []).map(normalizeMarker).filter((m) => m.date && m.label);
}

/**
 * Pulls the editor's parallel row arrays back into records, dropping rows with
 * nothing in them. A half-filled row is how an officer leaves the "add" row
 * they opened and didn't use — discarding it silently beats an error.
 */
export function parseMarkers(formData, semesterId) {
  const ids = formData.getAll("markerId");
  const dates = formData.getAll("markerDate");
  const labels = formData.getAll("markerLabel");

  const markers = [];
  for (let i = 0; i < ids.length; i++) {
    const date = clean(dates[i]);
    const label = clean(labels[i]);
    if (!date || !label) continue;
    markers.push({ id: String(ids[i]), semesterId, date, label });
  }
  return markers;
}

/** Chronological, for the editor's initial order. */
export function sortMarkers(markers) {
  return [...markers].sort((a, b) => a.date.localeCompare(b.date));
}
