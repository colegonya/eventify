const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarLoading() {
  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="h-8 w-40 animate-pulse rounded-sm bg-brand-ink/10" />
        <div className="h-9 w-56 animate-pulse rounded-sm bg-brand-ink/10" />
        <div className="h-9 w-64 animate-pulse rounded-sm bg-brand-ink/10" />
      </div>

      <div className="h-6 w-full animate-pulse rounded-sm bg-brand-ink/5" />

      <div className="grid min-h-0 flex-1 grid-cols-7 gap-px border border-paper-line bg-paper-line text-xs">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="bg-brand-ink/[0.04] p-1.5 text-center font-medium text-brand-ink/75"
          >
            {label}
          </div>
        ))}

        {Array.from({ length: 35 }, (_, i) => (
          <div key={i} className="min-h-0 bg-background p-1.5">
            <div className="h-3 w-4 animate-pulse rounded-sm bg-brand-ink/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
