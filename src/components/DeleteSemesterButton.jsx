"use client";

/**
 * Lives inside the semester's edit form and overrides its action via
 * formAction, so it reuses that form's hidden semesterId instead of needing a
 * second nested form (which HTML doesn't allow).
 */
export function DeleteSemesterButton({ label, action, disabled }) {
  return (
    <button
      type="submit"
      formAction={action}
      formNoValidate
      disabled={disabled}
      title={
        disabled
          ? "You can't delete your only semester. Create another one first."
          : undefined
      }
      onClick={(e) => {
        const ok = window.confirm(
          `Delete "${label}"? Its events, game days, and contacts are deleted with it. This can't be undone.`,
        );
        if (!ok) e.preventDefault();
      }}
      className="rounded-sm border border-red-300 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-brand-ink/10 disabled:text-brand-ink/30 disabled:hover:bg-transparent"
    >
      Delete
    </button>
  );
}
