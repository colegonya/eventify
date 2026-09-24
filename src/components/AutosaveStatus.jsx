/**
 * The "Saving… / Saved / Not saved: …" line under every autosaving editor.
 * A save that didn't go through turns red, since it means the officer's last
 * change isn't stored, and the line is live so screen readers announce it too.
 * After the automatic retries run out, `onRetry` adds a Retry button.
 */
export function AutosaveStatus({ label, error, onRetry }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        role="status"
        aria-live="polite"
        className={error ? "text-sm font-medium text-red-700" : "text-sm text-brand-ink/75"}
      >
        {label}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-sm border border-red-700/40 px-2 py-0.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-700/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700/40"
        >
          Retry
        </button>
      )}
    </span>
  );
}
