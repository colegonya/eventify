"use client";

import { useEffect, useRef } from "react";

/**
 * The keyboard and focus behavior both editor dialogs need: close on Escape,
 * pull focus into the panel on open, keep Tab cycling inside it, and hand
 * focus back to whatever opened it on close.
 *
 * This lives in one place because it already didn't. Both providers grew their
 * own copy of the Escape handler, and only the event editor ever got the focus
 * trap — so the equipment dialog opened with focus left behind on the page
 * underneath, and Tab walked straight out of the modal into the budget table.
 * A hook means the next fix here lands in both dialogs instead of one.
 *
 * Returns the ref to attach to the dialog panel.
 */
export function useModalDialog(open, close) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previouslyFocused = document.activeElement;

    // Queried fresh on every Tab rather than captured once: the forms inside
    // add and remove line-item rows while the dialog is open.
    const focusables = () =>
      Array.from(
        dialog.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);

    (focusables()[0] ?? dialog).focus();

    const onKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };

    dialog.addEventListener("keydown", onKeyDown);
    return () => {
      dialog.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  return dialogRef;
}
