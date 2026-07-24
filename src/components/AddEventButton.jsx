"use client";

import { useEditor } from "@/components/EditorProvider";

export function AddEventButton({ date }) {
  const { openNew } = useEditor();
  return (
    <button
      type="button"
      onClick={() => openNew(date)}
      aria-label="Add event"
      className="rounded-lg bg-brand-primary px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary/90"
    >
      <span aria-hidden className="sm:hidden">+</span>
      <span className="hidden sm:inline">+ Add Event</span>
    </button>
  );
}
