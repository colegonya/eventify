"use client";

import { useEditor } from "@/components/EditorProvider";

export function AddEventButton({ date }) {
  const { openNew } = useEditor();
  return (
    <button
      type="button"
      onClick={() => openNew(date)}
      aria-label="Add event"
      className="rounded-sm bg-brand-primary px-3.5 py-1.5 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <span aria-hidden className="sm:hidden">+</span>
      <span className="hidden sm:inline">+ Add Event</span>
    </button>
  );
}
