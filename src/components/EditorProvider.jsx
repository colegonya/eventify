"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { EventForm } from "@/components/EventForm";
import { computeSemesterBudget } from "@/lib/budget";
import { buildCalendarHref } from "@/lib/calendarUrl";

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
  maxBudgetCents,
  month,
  categories,
  categorySpendStats,
  drinkPresets,
  drinkItemGroups,
  // Equipment counts against the same semester cap as events, so it needs to
  // factor into the "remaining" preview shown while editing an event.
  equipmentExpectedCents = 0,
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

  // Close on Escape while the editor is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Focus management while the dialog is open: pull focus into it on open,
  // keep Tab cycling inside it, and restore focus to the trigger on close.
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement;

    const focusables = () =>
      Array.from(
        dialog.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    (focusables()[0] ?? dialog).focus();

    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Budget for the form's live headroom preview, excluding the event being
  // edited so its own spend isn't double-counted.
  const otherEventsExpectedCents = useMemo(() => {
    const budget = computeSemesterBudget(events, categoriesById);
    const thisContribution = editingEvent
      ? budget.perEvent.get(editingEvent.id)?.expectedContributionCents ?? 0
      : 0;
    return budget.expectedSpendCents - thisContribution + equipmentExpectedCents;
  }, [events, categoriesById, editingEvent, equipmentExpectedCents]);

  const value = useMemo(
    () => ({ openEvent, openNew, close }),
    [openEvent, openNew, close],
  );

  return (
    <EditorContext.Provider value={value}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-brand-ink/40 p-4 backdrop-blur-sm"
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
            className="mx-auto my-8 w-full max-w-2xl outline-none"
          >
            <EventForm
              key={eventId ?? "new"}
              semesterId={semesterId}
              chapterName={chapterName}
              event={editingEvent}
              defaultDate={date ?? `${month}-01`}
              maxBudgetCents={maxBudgetCents}
              otherEventsExpectedCents={otherEventsExpectedCents}
              categories={categories}
              categorySpendStats={categorySpendStats}
              drinkPresets={drinkPresets}
              drinkItemGroups={drinkItemGroups}
              onClose={close}
            />
          </div>
        </div>
      )}
    </EditorContext.Provider>
  );
}
