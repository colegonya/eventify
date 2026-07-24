import { eventDatesInRange, DEFAULT_DURATION_MINUTES } from "@/lib/dates";
import { CHAPTER_NAME } from "@/lib/config";

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function eventInterval(
  event,
) {
  // Day-only events (no start time) skip the time-overlap check entirely.
  if (!event.startTime) return null;
  const start = timeToMinutes(event.startTime);
  const end = event.endTime
    ? timeToMinutes(event.endTime)
    : start + DEFAULT_DURATION_MINUTES;
  return { start, end };
}

function isHostChapterEvent(event) {
  return event.host.trim().toLowerCase() === CHAPTER_NAME.trim().toLowerCase();
}

function intervalsOverlap(
  a,
  b,
) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Computes same-day time-overlap conflicts.
 * Game days are excluded by construction — they're never in `events`.
 */
export function computeConflicts(
  events,
) {
  const byDate = new Map();
  for (const event of events) {
    for (const date of eventDatesInRange(event.startDate, event.endDate)) {
      const list = byDate.get(date) ?? [];
      list.push(event);
      byDate.set(date, list);
    }
  }

  // eventId -> otherEventId -> severity, deduped across multi-day overlaps.
  const conflictsByEvent = new Map();
  const record = (id, otherId, severity) => {
    const existing = conflictsByEvent.get(id) ?? new Map();
    existing.set(otherId, severity);
    conflictsByEvent.set(id, existing);
  };

  for (const dayEvents of byDate.values()) {
    for (let i = 0; i < dayEvents.length; i++) {
      for (let j = i + 1; j < dayEvents.length; j++) {
        const a = dayEvents[i];
        const b = dayEvents[j];
        const intervalA = eventInterval(a);
        const intervalB = eventInterval(b);
        if (!intervalA || !intervalB) continue;
        if (!intervalsOverlap(intervalA, intervalB)) continue;

        const aHost = isHostChapterEvent(a);
        const bHost = isHostChapterEvent(b);
        // Only the host chapter's own events generate conflicts.
        if (!aHost && !bHost) continue;

        const severity = aHost && bHost ? "major" : "warning";
        record(a.id, b.id, severity);
        record(b.id, a.id, severity);
      }
    }
  }

  const result = new Map();
  for (const [id, others] of conflictsByEvent) {
    result.set(
      id,
      [...others.entries()].map(([otherEventId, severity]) => ({
        otherEventId,
        severity,
      })),
    );
  }
  return result;
}

export function worstSeverity(
  conflicts,
) {
  if (!conflicts || conflicts.length === 0) return null;
  return conflicts.some((c) => c.severity === "major") ? "major" : "warning";
}
