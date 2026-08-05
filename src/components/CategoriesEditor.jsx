"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveCategoriesAction } from "@/lib/actions";

let nextRowKey = 0;

export function CategoriesEditor({ categories }) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(() => categories.map((c) => ({ key: `existing-${c.id}`, ...c })));
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);

  const scheduleSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      startTransition(async () => {
        await saveCategoriesAction(formData);
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

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        key: `new-${nextRowKey++}`,
        id: crypto.randomUUID(),
        label: "",
        color: "#64748b",
        netsRevenue: false,
        excludeFromBudgetTotal: false,
        isOtherOrgCategory: false,
      },
    ]);

  const removeRow = (key) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    scheduleSave();
  };

  const input =
    "min-w-0 rounded-sm border border-brand-ink/20 bg-background px-2 py-1.5 text-sm text-brand-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onChange={scheduleSave}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-brand-ink/75">
        Categories are yours — add, rename, recolor, or remove them here. The three checkboxes
        control budget behavior: whether a category&apos;s cost nets against revenue (like a
        fundraiser), is excluded from the semester budget totals, or represents another org&apos;s
        event rather than your own.
      </p>

      {rows.length === 0 && (
        <p className="text-sm text-red-600">No categories yet — add one below before creating events.</p>
      )}

      <div className="flex flex-col divide-y divide-paper-line overflow-hidden rounded-md border border-paper-line bg-background shadow-[var(--shadow-resting)]">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-wrap items-center gap-3 p-3"
          >
            <input type="hidden" name="categoryId" value={row.id} />
            <input
              type="color"
              name="categoryColor"
              defaultValue={row.color}
              aria-label="Category color"
              className="h-9 w-9 shrink-0 cursor-pointer rounded-sm border border-brand-ink/20 p-0.5"
            />
            <input
              type="text"
              name="categoryLabel"
              defaultValue={row.label}
              aria-label="Category name"
              placeholder="Category name"
              className={`flex-1 basis-40 ${input}`}
            />
            <label
              className="flex items-center gap-1.5 text-xs text-brand-ink/75"
              title="Cost nets against revenue, e.g. a fundraiser"
            >
              <input
                type="checkbox"
                name="categoryNetsRevenue"
                value={row.id}
                defaultChecked={row.netsRevenue}
                className="h-4 w-4 accent-brand-primary"
              />
              Nets revenue
            </label>
            <label
              className="flex items-center gap-1.5 text-xs text-brand-ink/75"
              title="Tracked, but excluded from semester budget totals"
            >
              <input
                type="checkbox"
                name="categoryExcludeFromBudgetTotal"
                value={row.id}
                defaultChecked={row.excludeFromBudgetTotal}
                className="h-4 w-4 accent-brand-primary"
              />
              Exclude from budget
            </label>
            <label
              className="flex items-center gap-1.5 text-xs text-brand-ink/75"
              title="Another org's event, not your own"
            >
              <input
                type="checkbox"
                name="categoryIsOtherOrgCategory"
                value={row.id}
                defaultChecked={row.isOtherOrgCategory}
                className="h-4 w-4 accent-brand-primary"
              />
              Other org
            </label>
            <button
              type="button"
              onClick={() => removeRow(row.key)}
              className="ml-auto text-sm text-brand-ink/75 transition-colors hover:text-brand-primary"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="self-start text-sm font-medium text-brand-primary hover:underline"
        >
          + Add category
        </button>
        <span className="text-sm text-brand-ink/75">
          {isPending ? "Saving…" : saved ? "Saved" : ""}
        </span>
      </div>
    </form>
  );
}
