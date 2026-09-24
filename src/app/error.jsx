"use client";

import Link from "next/link";

// Never shows error.message. In production Next.js replaces it with a generic
// sentence anyway, and in development it can be a raw stack or a minified
// React error code, neither of which helps an officer. The digest is the
// short id Next.js also writes to the server log, so a screenshot of this
// page is enough to find the real error.
export default function Error({ error, reset }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <h2 className="text-base font-semibold text-brand-ink">Something went wrong</h2>
      <p className="max-w-sm text-sm text-brand-ink/75">
        This page didn&apos;t load. Try again, and if it keeps happening, send a screenshot of this
        page to whoever manages the app.
      </p>
      {error?.digest && (
        <p className="tabular-figures text-xs text-brand-ink/75">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-sm bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          Try again
        </button>
        <Link
          href="/calendar"
          className="rounded-sm border border-brand-ink/20 px-4 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
        >
          Back to calendar
        </Link>
      </div>
    </div>
  );
}
