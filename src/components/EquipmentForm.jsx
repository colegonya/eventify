"use client";

import { useState, useTransition } from "react";
import { saveEquipmentAction, deleteEquipmentAction } from "@/lib/actions";
import { centsToDisplay, pctOfCap } from "@/lib/budget";

function centsToDollarsInput(cents) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function dollarsToCents(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

let nextLineItemKey = 0;

export function EquipmentForm({
  semesterId,
  item,
  maxBudgetCents,
  otherExpectedCents,
  onClose,
}) {
  const [isPending, startTransition] = useTransition();
  const [lineItems, setLineItems] = useState(() =>
    (item?.actualSpend ?? []).map((line) => ({
      key: `existing-${line.id}`,
      name: line.name,
      amountCents: line.amountCents,
    })),
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expectedCostInput, setExpectedCostInput] = useState(
    centsToDollarsInput(item?.expectedCostCents ?? null),
  );

  const thisItemExpectedCents = dollarsToCents(expectedCostInput);
  const projectedTotalCents = otherExpectedCents + thisItemExpectedCents;
  const remainingCents = maxBudgetCents - projectedTotalCents;
  const thisItemPct = pctOfCap(thisItemExpectedCents, maxBudgetCents);
  const projectedPct = pctOfCap(projectedTotalCents, maxBudgetCents);
  const remainingPct = pctOfCap(remainingCents, maxBudgetCents);

  const input =
    "rounded-sm border border-brand-ink/20 bg-background px-3 py-2 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/30 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";
  const label = "flex flex-col gap-1.5 text-sm text-brand-ink";
  const sectionLegend = "px-1 text-[15px] font-semibold text-brand-ink";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          await saveEquipmentAction(formData);
          onClose();
        });
      }}
      className="mx-auto flex max-w-2xl flex-col gap-5 rounded-lg border border-paper-line bg-background p-5 shadow-[var(--shadow-overlay)] md:p-7"
    >
      <input type="hidden" name="semesterId" value={semesterId} />
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="flex items-center justify-between border-b border-paper-line pb-4">
        <h2 className="text-xl font-bold tracking-tight text-brand-ink">
          {item ? "Edit Equipment" : "Add Equipment"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-brand-ink/50 transition-colors hover:text-brand-primary hover:underline"
        >
          Close ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className={label}>
          Name
          <input type="text" name="name" required defaultValue={item?.name} className={input} />
        </label>
        <label className={label} title="Lower = more wanted">
          Priority
          <input
            type="number"
            step="1"
            name="priority"
            defaultValue={item?.priority ?? 0}
            className={input}
          />
        </label>
      </div>

      <label className={label}>
        Link <span className="font-normal text-brand-ink/50">(optional)</span>
        <input
          type="url"
          name="link"
          placeholder="https://…"
          defaultValue={item?.link}
          className={input}
        />
      </label>

      <fieldset className="flex flex-col gap-4 border-t border-paper-line pt-4">
        <legend className={sectionLegend}>Budget</legend>

        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            Expected cost ($)
            <input
              type="number"
              step="0.01"
              min="0"
              name="expectedCost"
              value={expectedCostInput}
              onChange={(e) => setExpectedCostInput(e.target.value)}
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-brand-ink">
            <input
              type="checkbox"
              name="expectedCostApproved"
              defaultChecked={item?.expectedCostApproval === "approved"}
              className="h-4 w-4 accent-brand-primary"
            />
            Approved
          </label>
        </div>

        {expectedCostInput && (
          <div className="tabular-figures -mt-2 px-1 text-xs text-brand-ink/70">
            {maxBudgetCents > 0 ? (
              <>
                {thisItemPct}% of cap · Semester total: {centsToDisplay(projectedTotalCents)} (
                {projectedPct}%) ·{" "}
                <span className={remainingCents < 0 ? "font-medium text-red-600" : ""}>
                  {centsToDisplay(remainingCents)} remaining ({remainingPct}%)
                </span>
              </>
            ) : (
              <>Semester total after save: {centsToDisplay(projectedTotalCents)}</>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm text-brand-ink">
            Actual spend line items{" "}
            <span className="font-normal text-brand-ink/50">(adding one marks it purchased)</span>
          </span>
          {lineItems.map((line, index) => (
            <div key={line.key} className="flex items-center gap-2">
              <input
                type="text"
                name="actualSpendName"
                placeholder="e.g. Couch from vendor"
                aria-label="Line item name"
                defaultValue={line.name}
                className={`flex-1 ${input}`}
              />
              <input
                type="number"
                step="0.01"
                name="actualSpendAmount"
                placeholder="0.00"
                aria-label="Line item amount"
                defaultValue={line.amountCents ? (line.amountCents / 100).toFixed(2) : ""}
                className={`w-28 ${input}`}
              />
              <button
                type="button"
                onClick={() =>
                  setLineItems((items) => items.filter((_, i) => i !== index))
                }
                className="text-sm text-brand-ink/40 transition-colors hover:text-brand-primary"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setLineItems((items) => [
                ...items,
                { key: `new-${nextLineItemKey++}`, name: "", amountCents: 0 },
              ])
            }
            className="self-start text-sm font-medium text-brand-primary transition-colors hover:underline"
          >
            + Add line item
          </button>
        </div>
      </fieldset>

      <label className={label}>
        Notes
        <textarea name="notes" rows={3} defaultValue={item?.notes} className={input} />
      </label>

      <div className="flex items-center justify-between border-t border-paper-line pt-5">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-sm bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save item"}
        </button>

        {item && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-sm border border-brand-ink/20 px-4 py-2 text-sm text-brand-ink transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
          >
            Delete item
          </button>
        )}

        {item && confirmingDelete && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-ink/70">Delete &quot;{item.name}&quot;?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteEquipmentAction(item.id);
                  onClose();
                })
              }
              className="rounded-sm bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {isPending ? "Deleting…" : "Confirm delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-sm border border-brand-ink/20 px-3 py-2 text-sm text-brand-ink transition-colors hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </form>
  );
}
