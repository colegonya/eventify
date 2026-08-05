"use client";

import { useEquipmentEditor } from "@/components/EquipmentEditorProvider";

export function AddEquipmentButton() {
  const { openNew } = useEquipmentEditor();
  return (
    <button
      type="button"
      onClick={() => openNew()}
      className="rounded-sm bg-brand-primary px-3.5 py-1.5 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      + Add Item
    </button>
  );
}
