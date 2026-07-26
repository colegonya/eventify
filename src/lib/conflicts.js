import { eventDatesInRange, DEFAULT_DURATION_MINUTES } from "@/lib/dates";

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
  let end = event.endTime
    ? timeToMinutes(event.endTime)
    : start + DEFAULT_DURATION_MINUTES;
  // An explicit end time at or before the start time means the event runs
  // past midnight (22:00-00:00, say), not backwards — roll it into the next
  // day so the overlap check still works, matching how the no-end-time
  // default-duration case above can already exceed a day's 1440 minutes.
  if (event.endTime && end <= start) {
    end += 24 * 60;
  }
  return { start, end };
}

function isHostChapterEvent(event, chapterName) {
  return event.host.trim().toLowerCase() === chapterName.trim().toLowerCase();
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
 * `chapterName` decides which events count as the chapter's own.
 */
export function computeConflicts(
  events,
  chapterName,
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

        const aHost = isHostChapterEvent(a, chapterName);
        const bHost = isHostChapterEvent(b, chapterName);
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
