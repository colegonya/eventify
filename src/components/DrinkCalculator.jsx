"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDrinkItemAction } from "@/lib/actions";

export function DrinkCalculator({
  categoryId,
  categoryLabel,
  presets,
  groups,
  onUseTotal,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(() =>
    groups.flatMap((group) => group.items).map((item) => ({ ...item, qty: 0 })),
  );
  const typicalOrder = presets[categoryId];

  const [showAddItem, setShowAddItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemGroupId, setNewItemGroupId] = useState(groups[0]?.id ?? "");
  const [addItemError, setAddItemError] = useState(null);

  const total = rows.reduce((sum, row) => sum + row.qty * row.price, 0);

  const cellInput =
    "tabular-figures rounded-sm border border-brand-ink/20 px-2 py-1 text-right text-sm outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  // Items just added this session render here immediately, ahead of the
  // server round-trip that adds them to `groups` for good.
  const knownIds = new Set(groups.flatMap((group) => group.items.map((item) => item.id)));
  const pendingRows = rows.filter((row) => !knownIds.has(row.id));

  // Gate on a preset id actually matching a current item, so a typical order
  // whose items have all since been deleted doesn't offer an Autofill that
  // fills nothing but zeros.
  const hasTypicalOrder = typicalOrder && rows.some((row) => typicalOrder[row.id]);

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
    if (rows.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      setAddItemError("An item with that name already exists.");
      return;
    }

    setAddItemError(null);
    const id = crypto.randomUUID();
    const formData = new FormData();
    formData.set("itemId", id);
    formData.set("itemName", name);
    formData.set("itemPrice", String(price));
    formData.set("itemGroupId", newItemGroupId);

    startTransition(async () => {
      await addDrinkItemAction(formData);
      setRows((rs) => [...rs, { id, name, price, qty: 0 }]);
      setNewItemName("");
      setNewItemPrice("");
      setShowAddItem(false);
      router.refresh();
    });
  };

  const renderRow = (row, i) => (
    <div
      key={row.id}
      className="grid grid-cols-[1fr_4.5rem_5.5rem] items-center gap-2 text-sm text-brand-ink"
    >
      <span>{row.name}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={row.qty || ""}
        placeholder="0"
        aria-label={`${row.name} quantity`}
        onChange={(e) => {
          const qty = Number.parseInt(e.target.value, 10) || 0;
          setRows((rs) => rs.map((r, ri) => (ri === i ? { ...r, qty } : r)));
        }}
        className={cellInput}
      />
      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-brand-ink/40">
          $
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={row.price}
          aria-label={`${row.name} price per unit`}
          onChange={(e) => {
            const price = Number.parseFloat(e.target.value) || 0;
            setRows((rs) => rs.map((r, ri) => (ri === i ? { ...r, price } : r)));
          }}
          className={`w-full pl-5 ${cellInput}`}
        />
      </div>
    </div>
  );

  return (
    <div className="overflow-hidden rounded-md border border-paper-line bg-background shadow-[var(--shadow-resting)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-brand-ink transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40 focus-visible:ring-inset"
      >
        Drink & supply calculator
        <span className="text-xs font-normal text-brand-ink/75">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3 border-t border-paper-line p-3">
          {hasTypicalOrder && (
            <button
              type="button"
              onClick={() =>
                setRows((rs) => rs.map((r) => ({ ...r, qty: typicalOrder[r.id] ?? 0 })))
              }
              className="self-start rounded-sm border border-brand-primary/30 bg-brand-primary/5 px-3 py-1.5 text-xs font-medium text-brand-primary transition-colors hover:bg-brand-primary/10"
            >
              Autofill? <span className="font-normal text-brand-primary/70">(typical {categoryLabel} order)</span>
            </button>
          )}

          <div className="grid grid-cols-[1fr_4.5rem_5.5rem] gap-2 text-xs font-medium text-brand-ink/75">
            <span>Item</span>
            <span className="text-right">Qty</span>
            <span className="text-right">$ / unit</span>
          </div>
          {groups.map((group) => (
            <div key={group.id} className="flex flex-col gap-1.5">
              <span className="self-start rounded-xs bg-brand-ink/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-ink">
                {group.label}
              </span>
              {group.items.map((groupItem) => {
                const i = rows.findIndex((row) => row.id === groupItem.id);
                return renderRow(rows[i], i);
              })}
            </div>
          ))}

          {pendingRows.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="self-start rounded-xs bg-brand-ink/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-ink">
                Just added
              </span>
              {pendingRows.map((row) => renderRow(row, rows.findIndex((r) => r.id === row.id)))}
            </div>
          )}

          {showAddItem ? (
            <div className="flex flex-col gap-2 bg-surface-1 p-3">
              <div className="grid grid-cols-[1fr_5rem] gap-2">
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name"
                  aria-label="New item name"
                  className="rounded-sm border border-brand-ink/20 px-2 py-1 text-sm outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
                />
                <div className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-sm text-brand-ink/40">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    placeholder="0.00"
                    aria-label="New item price per unit"
                    className={`w-full pl-5 ${cellInput}`}
                  />
                </div>
              </div>
              <select
                value={newItemGroupId}
                onChange={(e) => setNewItemGroupId(e.target.value)}
                aria-label="New item group"
                className="rounded-sm border border-brand-ink/20 px-2 py-1 text-sm outline-none transition-colors focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15"
              >
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.label}
                  </option>
                ))}
              </select>
              {addItemError && <p className="text-xs text-brand-primary">{addItemError}</p>}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddItem(false);
                    setAddItemError(null);
                  }}
                  className="rounded-sm px-3 py-1.5 text-xs font-medium text-brand-ink/75 transition-colors hover:text-brand-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={handleAddItem}
                  className="rounded-sm bg-brand-primary px-3 py-1.5 text-xs font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-60"
                >
                  {isPending ? "Adding…" : "Add item"}
                </button>
              </div>
            </div>
          ) : (
            groups.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAddItem(true)}
                className="self-start text-sm font-medium text-brand-primary transition-colors hover:underline"
              >
                + Add item
              </button>
            )
          )}

          <div className="tabular-figures flex items-center justify-between border-t border-paper-line pt-2 text-sm font-medium text-brand-ink">
            <span>Total: ${total.toFixed(2)}</span>
            <button
              type="button"
              disabled={total === 0}
              onClick={() => onUseTotal(total.toFixed(2))}
              className="rounded-sm bg-brand-primary px-3 py-1.5 text-xs font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-40"
            >
              Use as expected spend
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
