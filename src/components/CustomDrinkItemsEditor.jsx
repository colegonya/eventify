"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GROUP_LABELS } from "@/lib/drinkItems";
import { saveCustomDrinkItemsAction } from "@/lib/actions";

export function CustomDrinkItemsEditor({ items }) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(items);
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);

  const scheduleSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      startTransition(async () => {
        await saveCustomDrinkItemsAction(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const removeRow = (id) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
    scheduleSave();
  };

  const input =
    "rounded-md border border-brand-ink/20 bg-white px-2 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onChange={scheduleSave}
      className="flex flex-col gap-3"
    >
      <h2 className="text-sm font-semibold text-brand-ink">Custom items</h2>

      {rows.length === 0 && (
        <p className="text-sm text-brand-ink/75">
          No custom items yet — add one from the drink calculator on an event.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[1fr_5.5rem_9rem_auto] items-center gap-2"
          >
            <input type="hidden" name="customItemId" value={row.id} />
            <input
              type="text"
              name="customItemName"
              defaultValue={row.name}
              className={input}
            />
            <input
              type="number"
              name="customItemPrice"
              defaultValue={row.price}
              min="0"
              step="0.01"
              className={`text-right ${input}`}
            />
            <select name="customItemGroup" defaultValue={row.group} className={input}>
              {GROUP_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => removeRow(row.id)}
              className="shrink-0 text-sm text-brand-ink/75 hover:text-brand-primary"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <span className="self-end text-sm text-brand-ink/75">
        {isPending ? "Saving…" : saved ? "Saved" : ""}
      </span>
    </form>
  );
}
