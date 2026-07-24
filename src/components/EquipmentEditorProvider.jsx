"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useSearchParams } from "next/navigation";
import { EquipmentForm } from "@/components/EquipmentForm";
import { computeEquipmentContribution } from "@/lib/budget";

const EquipmentEditorContext = createContext(null);

export function useEquipmentEditor() {
  const ctx = useContext(EquipmentEditorContext);
  if (!ctx) {
    throw new Error("useEquipmentEditor must be used within an EquipmentEditorProvider");
  }
  return ctx;
}

export function EquipmentEditorProvider({
  items,
  semesterId,
  maxBudgetCents,
  // Everything else counting against the same cap this semester (events +
  // other equipment), so the form's headroom preview matches the page total.
  otherSpendExpectedCents,
  children,
}) {
  const searchParams = useSearchParams();

  const writeParams = useCallback(
    (itemId, isNew, push) => {
      const next = new URLSearchParams(searchParams.toString());
      if (itemId) next.set("equipment", itemId);
      else next.delete("equipment");
      if (isNew) next.set("newEquipment", "1");
      else next.delete("newEquipment");
      const query = next.toString();
      const url = query ? `/budget?${query}` : "/budget";
      if (push) {
        window.history.pushState(null, "", url);
      } else {
        window.history.replaceState(null, "", url);
      }
    },
    [searchParams],
  );

  const openItem = useCallback((id) => writeParams(id, false, true), [writeParams]);
  const openNew = useCallback(() => writeParams(null, true, true), [writeParams]);
  const close = useCallback(() => writeParams(null, false, false), [writeParams]);

  const itemId = searchParams.get("equipment");
  const isNew = searchParams.get("newEquipment") !== null;

  const editingItem = itemId ? items.find((i) => i.id === itemId) ?? null : null;
  const open = itemId ? editingItem !== null : isNew;

  // Close on Escape while the editor is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // otherSpendExpectedCents already excludes all equipment; add back every
  // other item's expected cost, excluding the one being edited.
  const otherExpectedCents = useMemo(() => {
    let total = otherSpendExpectedCents;
    for (const otherItem of items) {
      if (editingItem && otherItem.id === editingItem.id) continue;
      total += computeEquipmentContribution(otherItem).expectedContributionCents;
    }
    return total;
  }, [items, editingItem, otherSpendExpectedCents]);

  const value = useMemo(() => ({ openItem, openNew, close }), [openItem, openNew, close]);

  return (
    <EquipmentEditorContext.Provider value={value}>
      {children}
      {open && (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-brand-ink/40 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="mx-auto my-8 w-full max-w-2xl">
            <EquipmentForm
              key={itemId ?? "new"}
              semesterId={semesterId}
              item={editingItem}
              maxBudgetCents={maxBudgetCents}
              otherExpectedCents={otherExpectedCents}
              onClose={close}
            />
          </div>
        </div>
      )}
    </EquipmentEditorContext.Provider>
  );
}
