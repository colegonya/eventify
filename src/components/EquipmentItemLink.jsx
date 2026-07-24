"use client";

import { useEquipmentEditor } from "@/components/EquipmentEditorProvider";

export function EquipmentItemLink({
  id,
  className,
  children,
}) {
  const { openItem } = useEquipmentEditor();
  return (
    <button type="button" onClick={() => openItem(id)} className={className}>
      {children}
    </button>
  );
}
