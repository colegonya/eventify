export default function BudgetLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="h-9 w-40 animate-pulse rounded-lg bg-brand-ink/10" />
        <div className="h-9 w-64 animate-pulse rounded-lg bg-brand-ink/10" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="rounded-xl border border-brand-ink/10 bg-white p-5 shadow-sm">
            <div className="h-4 w-40 animate-pulse rounded bg-brand-ink/10" />
            <div className="mt-2 h-8 w-28 animate-pulse rounded bg-brand-ink/10" />
            <div className="mt-2 h-3 w-32 animate-pulse rounded bg-brand-ink/10" />
            <div className="mt-2 h-1.5 w-full animate-pulse rounded-full bg-brand-ink/10" />
          </div>
        ))}
      </div>

      <div className="h-64 w-full animate-pulse rounded-xl border border-brand-ink/10 bg-white shadow-sm" />

      <div className="flex flex-col gap-2">
        <div className="h-4 w-32 animate-pulse rounded bg-brand-ink/10" />
        <div className="h-48 w-full animate-pulse rounded-xl border border-brand-ink/10 bg-white shadow-sm" />
      </div>
    </div>
  );
}
