import Link from "next/link";
import { getCalendarPageData, getBrandingSettings } from "@/lib/data";
import { requireSemesters } from "@/lib/setup";
import { computeConflicts } from "@/lib/conflicts";
import { computeCategorySpendStats, computeEquipmentContribution } from "@/lib/budget";
import { equipmentItemsForSemester } from "@/lib/equipment";
import {
  getMonthGridDates,
  getWeekGridDates,
  monthLabel,
  weekLabel,
  shiftYearMonth,
  shiftWeek,
  isSameMonth,
  isToday,
  formatISODate,
  parseISODate,
  addDays,
  eventDatesInRange,
} from "@/lib/dates";
import { buildCalendarHref } from "@/lib/calendarUrl";
import { SemesterSwitcher } from "@/components/SemesterSwitcher";
import { Legend, LegendDropdown } from "@/components/Legend";
import { DayCell } from "@/components/DayCell";
import { EditorProvider } from "@/components/EditorProvider";
import { AddEventButton } from "@/components/AddEventButton";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams,
}) {
  const params = await searchParams;
  const semesters = await requireSemesters();

  if (semesters.length === 0) {
    return (
      <div className="p-6">
        <p className="text-brand-ink/75">No semesters yet.</p>
      </div>
    );
  }

  const semester =
    semesters.find((s) => s.id === params.semester) ?? semesters[0];

  // Default landing month: once the semester is close (within a week of its
  // start), open to today's month; before then — e.g. checking over the
  // summer — keep landing on the semester start.
  const today = new Date();
  const todayIso = formatISODate(today);
  const nearStartIso = formatISODate(addDays(parseISODate(semester.startDate), -7));
  const defaultMonth = todayIso >= nearStartIso ? todayIso.slice(0, 7) : semester.startDate.slice(0, 7);
  const month = params.month ?? defaultMonth;

  const [
    { events, gameDays, allEvents, drinkPresets, drinkItemGroups, equipmentItems, categories },
    { chapterName },
  ] = await Promise.all([
    getCalendarPageData(
      semester.id,
      semesters.map((s) => s.id),
    ),
    getBrandingSettings(),
  ]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const categorySpendStats = Object.fromEntries(computeCategorySpendStats(allEvents));

  const equipmentExpectedCents = equipmentItemsForSemester(equipmentItems, semester.id).reduce(
    (sum, item) => sum + computeEquipmentContribution(item).expectedContributionCents,
    0,
  );

  const conflicts = computeConflicts(events, chapterName);

  const eventsByDate = new Map();
  for (const event of events) {
    for (const date of eventDatesInRange(event.startDate, event.endDate)) {
      const list = eventsByDate.get(date) ?? [];
      list.push(event);
      eventsByDate.set(date, list);
    }
  }
  // Chronological within a day; day-only events (no start time) sort last.
  for (const list of eventsByDate.values()) {
    list.sort((a, b) => {
      if (a.startTime === null && b.startTime === null) return 0;
      if (a.startTime === null) return 1;
      if (b.startTime === null) return -1;
      return a.startTime.localeCompare(b.startTime);
    });
  }
  const gameDaysByDate = new Map();
  for (const gameDay of gameDays) {
    const list = gameDaysByDate.get(gameDay.date) ?? [];
    list.push(gameDay);
    gameDaysByDate.set(gameDay.date, list);
  }

  const view = params.view === "week" ? "week" : "month";
  const weekAnchor = params.week ?? `${month}-01`;

  const gridDates =
    view === "week" ? getWeekGridDates(weekAnchor) : getMonthGridDates(month);
  const weekCount = gridDates.length / 7;

  const currentParams = new URLSearchParams();
  for (const key of ["semester", "month", "view", "week", "event", "new", "date"]) {
    const value = params[key];
    if (value) currentParams.set(key, value);
  }

  const prevHref =
    view === "week"
      ? buildCalendarHref(currentParams, {
          semester: semester.id,
          view: "week",
          week: shiftWeek(weekAnchor, -1),
          month: null,
        })
      : buildCalendarHref(currentParams, {
          semester: semester.id,
          month: shiftYearMonth(month, -1),
          view: null,
          week: null,
        });
  const nextHref =
    view === "week"
      ? buildCalendarHref(currentParams, {
          semester: semester.id,
          view: "week",
          week: shiftWeek(weekAnchor, 1),
          month: null,
        })
      : buildCalendarHref(currentParams, {
          semester: semester.id,
          month: shiftYearMonth(month, 1),
          view: null,
          week: null,
        });
  const rangeLabel = view === "week" ? weekLabel(weekAnchor) : monthLabel(month);

  const monthToggleHref = buildCalendarHref(currentParams, {
    semester: semester.id,
    month: view === "week" ? weekAnchor.slice(0, 7) : month,
    view: null,
    week: null,
  });
  const weekToggleHref = buildCalendarHref(currentParams, {
    semester: semester.id,
    view: "week",
    week: view === "week" ? weekAnchor : `${month}-01`,
    month: null,
  });
  const addDate = view === "week" ? weekAnchor : `${month}-01`;

  const toggle = (label, href, active) => (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1 text-sm transition-colors ${
        active
          ? "bg-brand-primary font-medium text-white"
          : "text-brand-ink hover:bg-brand-ink/5"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <EditorProvider
      events={events}
      chapterName={chapterName}
      semesterId={semester.id}
      maxBudgetCents={semester.maxBudgetCents}
      month={month}
      categories={categories}
      categorySpendStats={categorySpendStats}
      drinkPresets={drinkPresets}
      drinkItemGroups={drinkItemGroups}
      equipmentExpectedCents={equipmentExpectedCents}
    >
    <div className="flex h-full flex-col gap-3 p-3 pb-[max(3rem,calc(env(safe-area-inset-bottom)+2.5rem))] md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SemesterSwitcher semesters={semesters} selectedId={semester.id} />

          <div className="flex items-center gap-2">
            <Link
              href={prevHref}
              aria-label="Previous month"
              className="rounded-lg border border-brand-ink/20 bg-white px-2.5 py-1.5 text-sm text-brand-ink shadow-sm hover:bg-brand-ink/5"
            >
              <span aria-hidden>←</span>
              <span className="hidden sm:inline"> Prev</span>
            </Link>
            <span className="min-w-24 text-center text-sm font-semibold text-brand-ink sm:min-w-40">
              {rangeLabel}
            </span>
            <Link
              href={nextHref}
              aria-label="Next month"
              className="rounded-lg border border-brand-ink/20 bg-white px-2.5 py-1.5 text-sm text-brand-ink shadow-sm hover:bg-brand-ink/5"
            >
              <span className="hidden sm:inline">Next </span>
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-brand-ink/20 bg-white p-0.5 shadow-sm">
            {toggle("Month", monthToggleHref, view === "month")}
            {toggle("Week", weekToggleHref, view === "week")}
          </div>
          <a
            href={`/calendar/export?semester=${semester.id}`}
            aria-label="Export .ics"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-ink/20 bg-white px-3 py-1.5 text-sm text-brand-ink shadow-sm hover:bg-brand-ink/5"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4 shrink-0"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span className="hidden sm:inline">Export .ics</span>
          </a>
          <AddEventButton date={addDate} />
          <LegendDropdown categories={categories} />
        </div>
      </div>

      <Legend categories={categories} />

      <div
        className={`grid min-h-0 flex-1 gap-px rounded-xl border border-brand-ink/10 bg-brand-ink/10 text-xs shadow-sm ${
          view === "week"
            ? "grid-cols-[repeat(7,minmax(220px,1fr))] overflow-x-auto overflow-y-hidden md:grid-cols-7"
            : "grid-cols-[repeat(7,minmax(110px,1fr))] overflow-x-auto overflow-y-hidden md:grid-cols-7 md:overflow-hidden"
        }`}
        style={{ gridTemplateRows: `auto repeat(${weekCount}, minmax(0, 1fr))` }}
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-brand-ink/[0.04] p-1.5 text-center font-medium text-brand-ink/75"
          >
            {label}
          </div>
        ))}

        {gridDates.map((date) => {
          const iso = formatISODate(date);
          return (
            <DayCell
              key={iso}
              date={date}
              iso={iso}
              events={eventsByDate.get(iso) ?? []}
              gameDays={gameDaysByDate.get(iso) ?? []}
              categoriesById={categoriesById}
              dimmed={view === "month" && !isSameMonth(date, month)}
              isToday={isToday(date, today)}
              semesterId={semester.id}
              conflicts={conflicts}
            />
          );
        })}
      </div>
    </div>
    </EditorProvider>
  );
}
