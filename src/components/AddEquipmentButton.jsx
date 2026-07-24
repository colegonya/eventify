"use client";

import { useEquipmentEditor } from "@/components/EquipmentEditorProvider";

export function AddEquipmentButton() {
  const { openNew } = useEquipmentEditor();
  return (
    <button
      type="button"
      onClick={() => openNew()}
      className="rounded-lg bg-brand-primary px-3.5 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-brand-primary/90"
    >
      + Add Item
    </button>
  );
}
