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

  // Categories that had no typical order when the page loaded: collapsed, and
  // sorted to the bottom. Frozen at mount rather than re-derived from
  // `presets`, because saveDrinkPresetsAction revalidates /drinks and so sends
  // fresh props through here after every autosave. Re-deriving would let a card
  // you're actively typing in jump to the bottom and collapse mid-edit (zeroing
  // its last quantity drops the key server-side), or shoot to the top the
  // moment its first quantity saves. The order settles on the next page load.
  const [emptyAtMount] = useState(
    () =>
      new Set(
        categories
          .filter((c) => !Object.values(presets[c.id] ?? {}).some((qty) => qty > 0))
          .map((c) => c.id),
      ),
  );

  // Stable sort, so categories keep their Categories-tab order within each half.
  const orderedCategories = [...categories].sort(
    (a, b) => Number(emptyAtMount.has(a.id)) - Number(emptyAtMount.has(b.id)),
  );

  const cellInput =
    "tabular-figures w-20 rounded-sm border border-brand-ink/20 bg-background px-2 py-1 text-right text-sm text-brand-ink outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onChange={scheduleSave}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="text-sm font-semibold text-brand-ink">Autofill quantities</h2>
        <p className="text-sm text-brand-ink/75">
          Set the quantities &ldquo;Autofill?&rdquo; fills in on the event form&apos;s drink
          calculator, per category. A category with every item left at 0 has no typical order, so
          Autofill won&apos;t show for it — those sit collapsed at the bottom here until you give
          them quantities.
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-brand-ink/75">Add a category from the Categories tab first.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orderedCategories.map((category) => {
            const categoryPreset = presets[category.id] ?? {};
            return (
              <details
                key={category.id}
                className="group self-start rounded-md border border-paper-line bg-background p-4 shadow-[var(--shadow-resting)]"
                open={!emptyAtMount.has(category.id)}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between rounded-sm text-sm font-semibold text-brand-ink transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 marker:content-none">
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
                    <div key={group.id} className="flex flex-col gap-1.5">
                      <span className="self-start rounded-xs bg-brand-ink/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-ink">
                        {group.label}
                      </span>
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 text-sm text-brand-ink"
                        >
                          <span className="truncate">{item.name}</span>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            name={`preset::${category.id}::${item.id}`}
                            defaultValue={categoryPreset[item.id] || ""}
                            aria-label={`${item.name} typical quantity for ${category.label}`}
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
