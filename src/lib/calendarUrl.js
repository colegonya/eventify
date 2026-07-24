export const CALENDAR_PARAM_KEYS = [
  "semester",
  "month",
  "view",
  "week",
  "event",
  "new",
  "date",
];

const NAV_KEYS = ["semester", "month", "view", "week"];
const EDITOR_KEYS = ["event", "new", "date"];

/**
 * Builds a /calendar href from the current query params plus a patch.
 * Only the known calendar keys survive; anything else in `current` is dropped.
 * Touching a nav key (semester/month/view/week) always clears the editor
 * keys (event/new/date), regardless of what `current` or `patch` say about
 * them, so navigating away always discards an in-progress edit.
 */
export function buildCalendarHref(
  current,
  patch,
) {
  const touchesNav = NAV_KEYS.some((key) => key in patch);
  const next = new URLSearchParams();

  for (const key of CALENDAR_PARAM_KEYS) {
    if (touchesNav && EDITOR_KEYS.includes(key)) continue;

    const patchedValue = key in patch ? patch[key] : undefined;
    if (patchedValue !== undefined) {
      if (patchedValue !== null) next.set(key, patchedValue);
      continue;
    }

    const currentValue = current.get(key);
    if (currentValue !== null) next.set(key, currentValue);
  }

  const query = next.toString();
  return query ? `/calendar?${query}` : "/calendar";
}
