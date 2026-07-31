"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GROUP_LABELS } from "@/lib/drinkItems";
import { saveCustomDrinkItemsAction, addDrinkItemAction } from "@/lib/actions";

export function CustomDrinkItemsEditor({ items, groups }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isAddPending, startAddTransition] = useTransition();
  const [rows, setRows] = useState(items);
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemGroup, setNewItemGroup] = useState(GROUP_LABELS[0] ?? "");
  const [addItemError, setAddItemError] = useState(null);

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

  const handleAddItem = () => {
    const name = newItemName.trim();
    const price = Number.parseFloat(newItemPrice);

    if (!name) {
      setAddItemError("Enter an item name.");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setAddItemError("Enter a valid price.");
      return;
    }
    if (groups.some((g) => g.items.some((item) => item.name.toLowerCase() === name.toLowerCase()))) {
      setAddItemError("An item with that name already exists.");
      return;
    }

    setAddItemError(null);
    const id = crypto.randomUUID();
    const formData = new FormData();
    formData.set("itemId", id);
    formData.set("itemName", name);
    formData.set("itemPrice", String(price));
    formData.set("itemGroup", newItemGroup);

    startAddTransition(async () => {
      await addDrinkItemAction(formData);
      setRows((rs) => [...rs, { id, name, price, group: newItemGroup }]);
      setNewItemName("");
      setNewItemPrice("");
      setShowAddItem(false);
      router.refresh();
    });
  };

  const input =
    "rounded-md border border-brand-ink/20 bg-white px-2 py-1.5 text-sm text-brand-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-brand-ink">Custom items</h2>
        <p className="text-sm text-brand-ink/75">
          Add anything the built-in list doesn&apos;t cover — a different brand, a non-alcohol
          item, your own cup count. New items show up in every category&apos;s drink calculator
          and in the quantity grid above.
        </p>
      </div>

      <form
        ref={formRef}
        onSubmit={(e) => e.preventDefault()}
        onChange={scheduleSave}
        className="flex flex-col gap-3"
      >
        {rows.length === 0 && (
          <p className="text-sm text-brand-ink/75">No custom items yet — add one below.</p>
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
                aria-label="Item name"
                className={input}
              />
              <input
                type="number"
                name="customItemPrice"
                defaultValue={row.price}
                min="0"
                step="0.01"
                aria-label={`Price per unit for ${row.name || "item"}`}
                className={`text-right ${input}`}
              />
              <select
                name="customItemGroup"
                defaultValue={row.group}
                aria-label={`Group for ${row.name || "item"}`}
                className={input}
              >
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

      {showAddItem ? (
        <div className="flex flex-col gap-2 rounded-lg border border-brand-ink/10 bg-brand-ink/[0.02] p-3">
          <div className="grid grid-cols-[1fr_5.5rem_9rem] gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item name"
              aria-label="New item name"
              className={input}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              placeholder="$ / unit"
              aria-label="New item price per unit"
              className={`text-right ${input}`}
            />
            <select
              value={newItemGroup}
              onChange={(e) => setNewItemGroup(e.target.value)}
              aria-label="New item group"
              className={input}
            >
              {GROUP_LABELS.map((label) => (
                <option key={label} value={label}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          {addItemError && <p className="text-xs text-red-600">{addItemError}</p>}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddItem(false);
                setAddItemError(null);
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-brand-ink/75 hover:text-brand-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isAddPending}
              onClick={handleAddItem}
              className="rounded-lg bg-brand-primary px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-brand-primary/90 disabled:opacity-60"
            >
              {isAddPending ? "Adding…" : "Add item"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddItem(true)}
          className="self-start text-sm font-medium text-brand-primary hover:underline"
        >
          + Add item
        </button>
      )}
    </div>
  );
}
