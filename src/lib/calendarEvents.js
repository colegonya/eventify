import { addDays, formatISODate, parseISODate } from "@/lib/dates";

/** Chronological within a day; day-only events (no start time) sort last. */
export function compareByStartTime(a, b) {
  if (a.startTime === null && b.startTime === null) return 0;
  if (a.startTime === null) return 1;
  if (b.startTime === null) return -1;
  return a.startTime.localeCompare(b.startTime);
}

/**
 * The event moved by a whole number of days. A multi-day event keeps its
 * length, whichever of its days was grabbed.
 */
export function shiftEvent(event, deltaDays) {
  const shift = (iso) => formatISODate(addDays(parseISODate(iso), deltaDays));
  return { ...event, startDate: shift(event.startDate), endDate: shift(event.endDate) };
}
