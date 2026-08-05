"use client";

export default function Error({
  error,
  reset,
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-medium text-brand-ink">Something went wrong loading this page.</p>
      <p className="max-w-sm text-xs text-brand-ink/75">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-sm bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
