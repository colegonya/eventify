export default function BudgetLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1">
        <div className="h-8 w-40 animate-pulse rounded-sm bg-brand-ink/10" />
        <div className="h-9 w-64 animate-pulse rounded-sm bg-brand-ink/10" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-md p-5 shadow-[var(--shadow-resting)]">
            <div className="h-4 w-40 animate-pulse rounded-sm bg-brand-ink/10" />
            <div className="mt-2 h-8 w-28 animate-pulse rounded-sm bg-brand-ink/10" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded-sm bg-brand-ink/10" />
            <div className="mt-2 h-1.5 w-full animate-pulse bg-brand-ink/10" />
          </div>
        ))}
      </div>

      <div className="h-64 w-full animate-pulse rounded-md bg-background shadow-[var(--shadow-resting)]" />

      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 animate-pulse rounded-sm bg-brand-ink/10" />
        <div className="h-48 w-full animate-pulse border border-paper-line bg-background" />
      </div>
    </div>
  );
}
