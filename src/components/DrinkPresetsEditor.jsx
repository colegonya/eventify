"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { saveDrinkPresetsAction } from "@/lib/actions";

export function DrinkPresetsEditor({
  presets,
  groups,
  categories,
}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);

  const scheduleSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      startTransition(async () => {
        await saveDrinkPresetsAction(formData);
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

  const cellInput =
    "w-20 rounded-md border border-brand-ink/20 bg-white px-2 py-1 text-right text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onChange={scheduleSave}
      className="flex flex-col gap-4"
    >
      <p className="text-sm text-brand-ink/75">
        Set the quantities &ldquo;Autofill?&rdquo; fills in on the event form&apos;s drink
        calculator, per category. A category with every item left at 0 has no typical order, so
        Autofill won&apos;t show for it.
      </p>

      {categories.length === 0 ? (
        <p className="text-sm text-brand-ink/75">Add a category from the Categories tab first.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => {
            const categoryPreset = presets[category.id] ?? {};
            return (
              <details
                key={category.id}
                className="group rounded-xl border border-brand-ink/10 bg-white p-4 shadow-sm"
                open={Object.keys(categoryPreset).length > 0}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-brand-ink marker:content-none">
                  {category.label}
                  <span className="text-xs font-normal text-brand-ink/75 group-open:hidden">
                    show
                  </span>
                  <span className="hidden text-xs font-normal text-brand-ink/75 group-open:inline">
                    hide
                  </span>
                </summary>

                <div className="mt-3 flex flex-col gap-3">
                  {groups.map((group) => (
                    <div key={group.label} className="flex flex-col gap-1.5">
                      <span className="self-start rounded-md bg-brand-ink/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-ink">
                        {group.label}
                      </span>
                      {group.items.map((item) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between gap-2 text-sm text-brand-ink"
                        >
                          <span className="truncate">{item.name}</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            name={`preset::${category.id}::${item.name}`}
                            defaultValue={categoryPreset[item.name] || ""}
                            placeholder="0"
                            className={cellInput}
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <span className="text-sm text-brand-ink/75">
          {isPending ? "Saving…" : saved ? "Saved" : ""}
        </span>
      </div>
    </form>
  );
}
