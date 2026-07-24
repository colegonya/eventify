function LegendItems({ categories }) {
  return (
    <>
      {categories.map((category) => (
        <span key={category.id} className="flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ background: category.color }}
          />
          {category.label}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-dashed border-brand-ink/50"
        />
        Tentative (italic, dashed border)
      </span>
    </>
  );
}

// Desktop-only: always-visible inline row. Hidden on mobile, where
// LegendDropdown renders the same items behind a compact trigger instead.
export function Legend({ categories }) {
  return (
    <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-brand-ink/75 md:flex">
      <LegendItems categories={categories} />
    </div>
  );
}

// Mobile-only: sits inline with the other toolbar buttons instead of taking
// its own row. Callers place this alongside Month/Week/Export/Add Event.
export function LegendDropdown({ categories }) {
  return (
    <details className="group relative md:hidden">
      <summary className="flex w-fit list-none items-center gap-1.5 rounded-lg border border-brand-ink/20 bg-white px-2.5 py-1.5 text-sm text-brand-ink shadow-sm marker:content-none">
        <span className="flex h-2.5 w-2.5 items-center justify-center">
          <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
        </span>
        Legend
        <span className="text-xs text-brand-ink/75 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="absolute right-0 top-full z-20 mt-1.5 flex w-64 max-w-[85vw] flex-col gap-1.5 rounded-lg border border-brand-ink/15 bg-white p-3 text-xs text-brand-ink/75 shadow-lg">
        <LegendItems categories={categories} />
      </div>
    </details>
  );
}
