"use client";

import { useFormStatus } from "react-dom";

/**
 * A submit button for a server-rendered form that shows it's working:
 * disabled with its pending label while the save is in flight, so a click
 * never looks like it did nothing and can't be sent twice.
 *
 * Two buttons can share a form (a semester row's Save and Delete). Give the
 * alternate one an `intent`; it's submitted with the form, and each button
 * only shows its pending label for its own click. Every button in the form
 * still disables while anything is in flight.
 */
export function SubmitButton({ children, pendingLabel, intent, className, disabled, ...props }) {
  const { pending, data } = useFormStatus();
  const submittedIntent = data?.get("intent") ?? null;
  const mine = pending && submittedIntent === (intent ?? null);

  return (
    <button
      type="submit"
      name={intent ? "intent" : undefined}
      value={intent}
      disabled={disabled || pending}
      aria-busy={mine || undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      {...props}
    >
      {mine ? pendingLabel : children}
    </button>
  );
}
