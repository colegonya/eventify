/**
 * The "Saving… / Saved / Not saved: …" line under every autosaving editor.
 * A refused save turns red, since it means the officer's last change isn't
 * stored, and the line is live so screen readers announce it too.
 */
export function AutosaveStatus({ label, error }) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={error ? "text-sm font-medium text-red-700" : "text-sm text-brand-ink/75"}
    >
      {label}
    </span>
  );
}
