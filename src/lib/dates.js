const MS_PER_DAY = 86_400_000;

/** Assumed duration for an event with no explicit end time. */
export const DEFAULT_DURATION_MINUTES = 3 * 60;

export function parseISODate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

export function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/**
 * Whole days from one ISO date to another, negative when the first is later.
 * Both sides parse as UTC midnight, so this counts calendar days and never
 * picks up an off-by-one from a local timezone offset.
 */
export function daysBetween(fromISO, toISO) {
  return Math.round((parseISODate(toISO).getTime() - parseISODate(fromISO).getTime()) / MS_PER_DAY);
}

export function parseYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  return { year, month };
}

export function shiftYearMonth(yearMonth, delta) {
  const { year, month } = parseYearMonth(yearMonth);
  const total = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(total / 12);
  const newMonth = (total % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function monthLabel(yearMonth) {
  const { year, month } = parseYearMonth(yearMonth);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Sun-Sat week grid covering the given month, padded with adjacent-month days. */
export function getMonthGridDates(yearMonth) {
  const { year, month } = parseYearMonth(yearMonth);
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));

  const gridStart = addDays(firstOfMonth, -firstOfMonth.getUTCDay());
  const daysAfterLast = 6 - lastOfMonth.getUTCDay();
  const gridEnd = addDays(lastOfMonth, daysAfterLast);

  const dates = [];
  for (let d = gridStart; d.getTime() <= gridEnd.getTime(); d = addDays(d, 1)) {
    dates.push(d);
  }
  return dates;
}

/** The seven Sun-Sat dates of the week containing the given ISO date. */
export function getWeekGridDates(iso) {
  const anchor = parseISODate(iso);
  const weekStart = addDays(anchor, -anchor.getUTCDay());
  const dates = [];
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(weekStart, i));
  }
  return dates;
}

/** Shifts an ISO date by whole weeks, returning a new ISO date. */
export function shiftWeek(iso, deltaWeeks) {
  return formatISODate(addDays(parseISODate(iso), deltaWeeks * 7));
}

const SHORT_MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Human label for the Sun-Sat week containing the given ISO date, e.g. "Aug 23 - 29, 2026". */
export function weekLabel(iso) {
  const dates = getWeekGridDates(iso);
  const start = dates[0];
  const end = dates[6];
  const sMonth = SHORT_MONTH_NAMES[start.getUTCMonth()];
  const eMonth = SHORT_MONTH_NAMES[end.getUTCMonth()];
  const sDay = start.getUTCDate();
  const eDay = end.getUTCDate();
  const sYear = start.getUTCFullYear();
  const eYear = end.getUTCFullYear();

  if (sYear !== eYear) {
    return `${sMonth} ${sDay}, ${sYear} - ${eMonth} ${eDay}, ${eYear}`;
  }
  if (start.getUTCMonth() !== end.getUTCMonth()) {
    return `${sMonth} ${sDay} - ${eMonth} ${eDay}, ${eYear}`;
  }
  return `${sMonth} ${sDay} - ${eDay}, ${eYear}`;
}

export function isSameMonth(date, yearMonth) {
  const { year, month } = parseYearMonth(yearMonth);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1;
}

/** Whether a grid date is today, given today as YYYY-MM-DD (see todayInTimeZone). */
export function isToday(date, todayIso) {
  return formatISODate(date) === todayIso;
}

/** Inclusive list of ISO dates from startDate to endDate (same value for single-day events). */
export function eventDatesInRange(startDate, endDate) {
  const dates = [];
  let cursor = parseISODate(startDate);
  const last = parseISODate(endDate);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(formatISODate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** A real calendar date as YYYY-MM-DD, between 2000 and 2100. Rejects 2026-02-30. */
export function isRealIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 2000 || year > 2100) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A real month as YYYY-MM, between 2000 and 2100. */
export function isRealYearMonth(value) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) && isRealIsoDate(`${value}-01`);
}

export const isTime = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Whether a string is an IANA time zone this runtime knows, like "America/Los_Angeles". */
export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== "string" || !timeZone) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Today's date as YYYY-MM-DD in the organization's time zone.
 *
 * Servers run on UTC, so formatISODate(new Date()) turns over at 5pm Pacific
 * or 8pm Eastern: every evening the today marker jumped to tomorrow, "meeting
 * was N days ago" was off by one, and on a month's last evening the calendar
 * opened on the next month. Evenings are exactly when a social chair checks.
 */
export function todayInTimeZone(timeZone, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
