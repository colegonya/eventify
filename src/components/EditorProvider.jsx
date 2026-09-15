"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { computeSemesterBudget } from "@/lib/budget";
import { buildCalendarHref } from "@/lib/calendarUrl";
import { getEditorSupportingDataAction } from "@/lib/actions";
import { useModalDialog } from "@/components/useModalDialog";

function EventFormSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 rounded-lg border border-paper-line bg-background p-5 shadow-[var(--shadow-overlay)] md:p-7">
      <div className="h-6 w-40 animate-pulse rounded-sm bg-brand-ink/10" />
      <div className="h-24 w-full animate-pulse rounded-sm bg-brand-ink/10" />
      <div className="h-40 w-full animate-pulse rounded-sm bg-brand-ink/10" />
    </div>
  );
}

// EventForm (and the DrinkCalculator it pulls in) is only ever rendered
// behind `open &&` below, but a static import would still ship its JS to
// every /calendar visit whether the dialog opens or not. Loaded on demand
// instead. Keep `ssr: true` (the default) rather than reaching for
// `ssr: false` to trim it further — a Budget-page alert can deep-link to
// `/calendar?...&event=X` with the dialog already open on first load, and
// that still needs to render inline in the server HTML, not flash in after
// hydration.
const EventForm = dynamic(
  () => import("@/components/EventForm").then((mod) => mod.EventForm),
  { loading: EventFormSkeleton },
);

const EditorContext = createContext(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) {
    throw new Error("useEditor must be used within an EditorProvider");
  }
  return ctx;
}

export function EditorProvider({
  events,
  chapterName,
  semesterId,
  semesterIds,
  maxBudgetCents,
  month,
  categories,
  // Only set when the page loaded with the editor already open (a deep-linked
  // ?event=/?new= URL) — the server fetched the editor's supporting data
  // up front for that case. See the fetch effect below for why this needs to
  // suppress that first client-side fetch rather than just seeding state.
  initialEditorData = null,
  children,
}) {
  const searchParams = useSearchParams();
  const categoriesById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories],
  );

  const writeParams = useCallback(
    (patch, push) => {
      const url = buildCalendarHref(searchParams, patch);
      // Opening pushes a history entry so the browser Back button closes the
      // editor (via popstate → useSearchParams). Closing replaces in place so
      // we always land on a clean calendar URL, even for a cold-loaded
      // ?event= link that has no prior entry to go back to.
      if (push) {
        window.history.pushState(null, "", url);
      } else {
        window.history.replaceState(null, "", url);
      }
    },
    [searchParams],
  );

  const openEvent = useCallback(
    (id) => {
      writeParams({ event: id, new: null, date: null }, true);
    },
    [writeParams],
  );

  const openNew = useCallback(
    (date) => {
      writeParams({ event: null, new: "1", date }, true);
    },
    [writeParams],
  );

  const close = useCallback(() => {
    writeParams({ event: null, new: null, date: null }, false);
  }, [writeParams]);

  const eventId = searchParams.get("event");
  const isNew = searchParams.get("new") !== null;
  const date = searchParams.get("date");

  const editingEvent = eventId
    ? events.find((e) => e.id === eventId) ?? null
    : null;
  const open = eventId ? editingEvent !== null : isNew;

  const dialogRef = useModalDialog(open, close);

  // Drink presets/groups, categorySpendStats, and equipmentExpectedCents —
  // only consumed inside the dialog below — are fetched on demand when it
  // opens instead of on every calendar view. Warm the EventForm chunk in
  // parallel with the data fetch (dynamic() already lazy-loads it, but
  // waiting to reference <EventForm> until data is ready would otherwise
  // serialize the two); the actual mount still waits on `editorData`, since
  // DrinkCalculator seeds its row state from `drinkItemGroups` only once, on
  // mount, and wouldn't pick up the real groups if it mounted early on an
  // empty placeholder.
  const [editorData, setEditorData] = useState(initialEditorData);
  // A deep-linked page load lands here with `open` already true on the very
  // first render, and initialEditorData already holding what the server
  // fetched for it — skip that one fetch so hydration doesn't blank the
  // server-rendered form back to a skeleton just to re-fetch the same data.
  // Gated on `open` too, not just `initialEditorData`: the page fetches that
  // data speculatively off the URL alone (?event=/?new= present), so a stale
  // ?event=<bad-id> link can hand us real initialEditorData while `open`
  // still correctly computes false — that data went unused, and shouldn't
  // make a later *genuine* open skip fetching fresh data for itself.
  const skipNextFetch = useRef(open && initialEditorData !== null);
  const [, startTransition] = useTransition();
  useEffect(() => {
    if (!open) return;
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    let cancelled = false;
    import("@/components/EventForm");
    startTransition(async () => {
      setEditorData(null);
      const data = await getEditorSupportingDataAction(semesterId, semesterIds);
      if (!cancelled) setEditorData(data);
    });
    return () => {
      cancelled = true;
    };
  }, [open, semesterId, semesterIds]);

  // Budget for the form's live headroom preview, excluding the event being
  // edited so its own spend isn't double-counted.
  const otherEventsExpectedCents = useMemo(() => {
    const budget = computeSemesterBudget(events, categoriesById);
    const thisContribution = editingEvent
      ? budget.perEvent.get(editingEvent.id)?.expectedContributionCents ?? 0
      : 0;
    return budget.expectedSpendCents - thisContribution + (editorData?.equipmentExpectedCents ?? 0);
  }, [events, categoriesById, editingEvent, editorData]);

  const value = useMemo(
    () => ({ openEvent, openNew, close }),
    [openEvent, openNew, close],
  );

  return (
    <EditorContext.Provider value={value}>
      {children}
      {open && (
        <div
          className="animate-scrim-in fixed inset-0 z-50 overflow-y-auto bg-brand-ink/40 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-editor-title"
            tabIndex={-1}
            className="animate-panel-in mx-auto my-8 w-full max-w-2xl outline-none"
          >
            {editorData ? (
              <EventForm
                key={eventId ?? "new"}
                semesterId={semesterId}
                chapterName={chapterName}
                event={editingEvent}
                defaultDate={date ?? `${month}-01`}
                maxBudgetCents={maxBudgetCents}
                otherEventsExpectedCents={otherEventsExpectedCents}
                categories={categories}
                categorySpendStats={editorData.categorySpendStats}
                drinkPresets={editorData.drinkPresets}
                drinkItemGroups={editorData.drinkItemGroups}
                onClose={close}
              />
            ) : (
              <EventFormSkeleton />
            )}
          </div>
        </div>
      )}
    </EditorContext.Provider>
  );
}
