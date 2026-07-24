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
      className={`truncate rounded-md px-1.5 py-1 text-[11px] leading-tight shadow-sm md:line-clamp-2 md:whitespace-normal md:break-words ${
        tentative ? "border-2 border-dashed border-white/80 italic" : ""
      }`}
    >
      {severity && <span aria-hidden>⚠ </span>}
      {event.name}
      {timeLabel}
    </div>
  );
}
