"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDrinkGroupsAction } from "@/lib/actions";

export function DrinkGroupsEditor({ groups }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(groups);
  const [saved, setSaved] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);

  const scheduleSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      startTransition(async () => {
        await saveDrinkGroupsAction(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
        // The presets grid below renders a row per catalog item — refresh so
        // it picks up adds/renames/removals without a manual reload.
        router.refresh();
      });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const addGroup = () => {
    setRows((rs) => [...rs, { id: crypto.randomUUID(), label: "", items: [] }]);
  };

  const deleteGroup = (groupId) => {
    setRows((rs) => rs.filter((g) => g.id !== groupId));
    setConfirmDeleteId(null);
    scheduleSave();
  };

  const addItem = (groupId) => {
    setRows((rs) =>
      rs.map((g) =>
        g.id === groupId
          ? { ...g, items: [...g.items, { id: crypto.randomUUID(), name: "", price: "" }] }
          : g,
      ),
    );
  };

  const removeItem = (groupId, itemId) => {
    setRows((rs) =>
      rs.map((g) =>
        g.id === groupId ? { ...g, items: g.items.filter((i) => i.id !== itemId) } : g,
      ),
    );
    scheduleSave();
  };

  const input =
    "rounded-md border border-brand-ink/20 bg-white px-2 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-brand-ink">Drink catalog</h2>
        <p className="text-sm text-brand-ink/75">
          The groups and items every drink calculator works from. Rename, reprice, or delete
          anything; new items show up in each category&apos;s autofill grid below and in every
          event&apos;s drink calculator.
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={(e) => e.preventDefault()}
        onChange={scheduleSave}
        className="flex flex-col gap-4"
      >
        {rows.length === 0 && (
          <p className="text-sm text-brand-ink/75">No groups yet — add one below.</p>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((group) => (
            <div
              key={group.id}
              className="flex flex-col gap-3 rounded-xl border border-brand-ink/10 bg-white p-4 shadow-sm"
            >
              <input
                type="text"
                name={`group::${group.id}::label`}
                defaultValue={group.label}
                placeholder="Group name"
                aria-label="Group name"
                className={`font-semibold ${input}`}
              />

              <div className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <div key={item.id} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
                    <input
                      type="text"
                      name={`item::${group.id}::${item.id}::name`}
                      defaultValue={item.name}
                      placeholder="Item name"
                      aria-label="Item name"
                      className={input}
                    />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-brand-ink/40">
                        $
                      </span>
                      <input
                        type="number"
                        name={`item::${group.id}::${item.id}::price`}
                        defaultValue={item.price}
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        aria-label={`Price per unit for ${item.name || "item"}`}
                        className={`w-full pl-5 text-right ${input}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(group.id, item.id)}
                      className="shrink-0 text-sm text-brand-ink/75 hover:text-brand-primary"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => addItem(group.id)}
                  className="text-sm font-medium text-brand-primary hover:underline"
                >
                  + Add item
                </button>
                {confirmDeleteId === group.id ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-brand-ink/75">Delete group and its items?</span>
                    <button
                      type="button"
                      onClick={() => deleteGroup(group.id)}
                      className="font-medium text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="font-medium text-brand-ink/75 hover:text-brand-ink"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(group.id)}
                    className="text-xs text-brand-ink/75 hover:text-brand-primary"
                  >
                    Delete group
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={addGroup}
            className="self-start text-sm font-medium text-brand-primary hover:underline"
          >
            + Add group
          </button>
          <span className="text-sm text-brand-ink/75">
            {isPending ? "Saving…" : saved ? "Saved" : ""}
          </span>
        </div>
      </form>
    </div>
  );
}
