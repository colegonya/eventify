"use client";

import { useState } from "react";
import { EventChip } from "@/components/EventChip";
import { useEditor } from "@/components/EditorProvider";
import { compareByStartTime } from "@/lib/calendarEvents";
import { worstSeverity } from "@/lib/conflicts";

const DRAG_MIME = "application/x-calendar-event";

export function DayCell({
  date,
  iso,
  events,
  markers,
  categoriesById,
  dimmed,
  isToday,
  conflicts,
}) {
  const { openEvent, openNew, moveEvent, movedEvents } = useEditor();
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState(null);

  // An event dropped a moment ago shows on its new days while the server
  // saves the move. See moveEvent in EditorProvider.
  let shownEvents = events;
  if (movedEvents.size > 0) {
    shownEvents = events.filter((e) => !movedEvents.has(e.id));
    for (const moved of movedEvents.values()) {
      if (moved.startDate <= iso && iso <= moved.endDate) shownEvents.push(moved);
    }
    shownEvents.sort(compareByStartTime);
  }

  return (
    <div
      // Marks the column ScrollTodayIntoView centers on a narrow screen.
      data-today={isToday ? "" : undefined}
      onDragOver={(e) => {
        // Only a dragged event pill carries our MIME type; ignore everything else.
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(DRAG_MIME);
        if (!raw) return;
        e.preventDefault();
        setDragOver(false);
        const { eventId, fromIso } = JSON.parse(raw);
        if (fromIso === iso) return;
        moveEvent(eventId, fromIso, iso);
      }}
      className={`group flex min-h-0 flex-col overflow-hidden p-1 transition-[background-color,box-shadow] ${
        dragOver
          ? "bg-brand-primary/5 ring-2 ring-inset ring-brand-primary"
          : dimmed
            ? "bg-brand-ink/[0.03] hover:bg-brand-ink/[0.05]"
            : "bg-background hover:bg-brand-ink/[0.02]"
      } ${dimmed ? "text-brand-ink/30" : ""}`}
    >
      <div className="mb-0.5 flex shrink-0 items-center justify-between">
        <span
          className={`tabular-figures inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium ${
            isToday
              ? "bg-brand-primary text-brand-primary-ink"
              : dimmed
                ? "text-brand-ink/40"
                : "text-brand-ink/70"
          }`}
        >
          {date.getUTCDate()}
        </span>
        <button
          type="button"
          onClick={() => openNew(iso)}
          aria-label={`Add event on ${iso}`}
          title="Add event on this day"
          className="inline-flex h-6 w-6 items-center justify-center rounded-sm text-[15px] leading-none text-brand-ink/0 transition-colors group-hover:text-brand-ink/60 hover:!text-brand-primary focus-visible:!text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 pointer-coarse:text-brand-ink/60 pointer-coarse:active:text-brand-primary"
        >
          +
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {markers.map((marker) => (
          <div
            key={marker.id}
            className="truncate rounded-xs border border-dashed border-brand-ink/40 px-1.5 py-0.5 text-[11px] italic text-brand-ink/75"
            title={marker.label}
          >
            {marker.label}
          </div>
        ))}
        {shownEvents.map((event) => (
          <div
            key={event.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData(
                DRAG_MIME,
                JSON.stringify({ eventId: event.id, fromIso: iso }),
              );
              setDraggingId(event.id);
            }}
            onDragEnd={() => setDraggingId(null)}
            className={`cursor-grab rounded-xs transition-[box-shadow,transform] duration-150 active:cursor-grabbing ${
              draggingId === event.id ? "scale-[1.03] shadow-[var(--shadow-lifted)]" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => openEvent(event.id)}
              className="block w-full rounded-xs text-left transition-[filter] duration-150 hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
            >
              <EventChip
                event={event}
                severity={worstSeverity(conflicts.get(event.id))}
                category={categoriesById.get(event.category)}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
