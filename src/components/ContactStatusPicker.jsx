"use client";

import { useEffect, useRef, useState } from "react";
import { CONTACT_STATUSES } from "@/types/contact";
import { CONTACT_STATUS_STYLES } from "@/lib/contactStatusColors";

/**
 * A native <select> can't be trusted to keep its <option> colors: Chrome and
 * Edge repaint the currently-selected row in the popup with the OS accent
 * color (system blue on Windows), overriding any inline style — so the
 * status that's actually selected is the one most likely to render in the
 * wrong color. This renders the same pill-and-list look ourselves so every
 * row keeps its real status color, selected or not.
 */
export function ContactStatusPicker({ name, value, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between rounded-full px-3 py-1.5 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1 ${CONTACT_STATUS_STYLES[value]}`}
      >
        <span className="truncate">{value}</span>
        <span aria-hidden className={`ml-1.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Status"
          className="absolute inset-x-0 top-full z-10 mt-1.5 overflow-hidden rounded-lg border border-brand-ink/15 bg-background shadow-[var(--shadow-lifted)]"
        >
          {CONTACT_STATUSES.map((status) => (
            <li key={status} role="option" aria-selected={status === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(status);
                  setOpen(false);
                }}
                className={`block w-full px-3 py-1.5 text-left text-sm outline-none transition-[filter] hover:brightness-95 focus-visible:brightness-95 ${CONTACT_STATUS_STYLES[status]}`}
              >
                {status}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
