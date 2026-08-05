function LegendItems({ categories }) {
  return (
    <>
      {categories.map((category) => (
        <span key={category.id} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-xs"
            style={{ background: category.color }}
          />
          {category.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-xs border-2 border-dashed border-brand-ink/50"
        />
        Tentative (italic, dashed border)
      </span>
    </>
  );
}

// Desktop-only: always-visible inline row, styled as a printed planner's
// color key. Hidden on mobile, where LegendDropdown renders the same items
// behind a compact trigger instead.
export function Legend({ categories }) {
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-1 text-xs text-brand-ink/75 md:flex">
      <LegendItems categories={categories} />
    </div>
  );
}

// Mobile-only: sits inline with the other toolbar buttons instead of taking
// its own row. Callers place this alongside Month/Week/Export/Add Event.
export function LegendDropdown({ categories }) {
  return (
    <details className="group relative md:hidden">
      <summary className="flex w-fit list-none items-center gap-1.5 rounded-sm border border-brand-ink/20 bg-background px-2.5 py-1.5 text-sm text-brand-ink transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 marker:content-none">
        <span className="flex h-2.5 w-2.5 items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-xs bg-brand-primary" />
        </span>
        Legend
        <span className="text-xs text-brand-ink/75 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1.5 flex w-64 max-w-[85vw] flex-col gap-1.5 rounded-lg border border-brand-ink/15 bg-background p-3 text-xs text-brand-ink/75 shadow-[var(--shadow-lifted)]">
        <LegendItems categories={categories} />
      </div>
    </details>
  );
}
