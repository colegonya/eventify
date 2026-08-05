import { CONFLICT_STYLES } from "@/lib/constants";
import { contrastTextColor } from "@/lib/color";

const FALLBACK_COLOR = "#64748b";

export function EventChip({
  event,
  severity,
  category,
}) {
  const color = category?.color ?? FALLBACK_COLOR;
  const style = severity ? CONFLICT_STYLES[severity] : { background: color, color: contrastTextColor(color) };
  const timeLabel = event.startTime ? ` · ${event.startTime}` : "";
  const categoryLabel = category?.label ?? "Uncategorized";

  const tentative = event.status === "tentative";

  return (
    <div
      title={`${event.name} (${categoryLabel})${severity ? " — conflict" : ""}${tentative ? " — tentative, unconfirmed" : ""}`}
      style={style}
      // Single-line truncation at every breakpoint. This used to be `truncate`
      // plus `md:line-clamp-2`, but -webkit-line-clamp never engaged (the
      // element kept a non--webkit-box display), so on desktop a long name
      // rendered two lines with the second sliced through the middle of the
      // glyphs and no ellipsis. One clean truncated line also fits more events
      // per day cell, and the full name is always in the title tooltip.
      className={`truncate rounded-xs px-1.5 py-1 text-[11px] font-medium leading-tight ${
        tentative ? "border-2 border-dashed border-white/80 italic" : ""
      }`}
    >
      {severity && <span aria-hidden>⚠ </span>}
      {event.name}
      {timeLabel}
    </div>
  );
}
