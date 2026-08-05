"use client";

import { useState, useTransition } from "react";
import { saveEventAction, deleteEventAction } from "@/lib/actions";
import {
  centsToDisplay,
  computeContribution,
  isExcludedFromBudgetTotal,
  pctOfCap,
} from "@/lib/budget";
import { DEFAULT_DURATION_MINUTES } from "@/lib/dates";
import { DrinkCalculator } from "@/components/DrinkCalculator";

function centsToDollarsInput(cents) {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

function dollarsToCents(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

let nextLineItemKey = 0;

export function EventForm({
  semesterId,
  chapterName,
  event,
  defaultDate,
  maxBudgetCents,
  otherEventsExpectedCents,
  categories,
  categorySpendStats,
  drinkPresets,
  drinkItemGroups,
  onClose,
}) {
  const [isPending, startTransition] = useTransition();
  const [lineItems, setLineItems] = useState(() =>
    (event?.actualSpend ?? []).map((item) => ({
      key: `existing-${item.id}`,
      name: item.name,
      amountCents: item.amountCents,
    })),
  );
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [formError, setFormError] = useState(null);

  const [categoryId, setCategoryId] = useState(
    event?.category ?? categories[0]?.id ?? "",
  );
  const [host, setHost] = useState(event?.host ?? chapterName);
  const [expectedSpendInput, setExpectedSpendInput] = useState(
    centsToDollarsInput(event?.expectedSpendCents ?? null),
  );
  const [hostShareInput, setHostShareInput] = useState(
    event?.hostShareFraction != null ? String(Math.round(event.hostShareFraction * 100)) : "",
  );
  const [revenueInput, setRevenueInput] = useState(
    centsToDollarsInput(event?.revenueCents ?? null),
  );
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(
    Boolean(event?.hostShareFraction != null || event?.revenueCents != null),
  );

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const categoryStats = categorySpendStats[categoryId];

  const thisEventExpectedCents = computeContribution({
    netsRevenue: selectedCategory?.netsRevenue ?? false,
    expectedSpendCents: dollarsToCents(expectedSpendInput),
    actualSpendCents: 0,
    hostShareFraction: hostShareInput ? Number(hostShareInput) / 100 : null,
    revenueCents: dollarsToCents(revenueInput),
  }).expectedContributionCents;
  const projectedTotalCents =
    otherEventsExpectedCents + (isExcludedFromBudgetTotal(selectedCategory) ? 0 : thisEventExpectedCents);
  const remainingCents = maxBudgetCents - projectedTotalCents;
  const thisEventPct = pctOfCap(thisEventExpectedCents, maxBudgetCents);
  const projectedPct = pctOfCap(projectedTotalCents, maxBudgetCents);
  const remainingPct = pctOfCap(remainingCents, maxBudgetCents);

  const input =
    "rounded-sm border border-brand-ink/20 bg-background px-3 py-2 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/30 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";
  const label = "flex flex-col gap-1.5 text-sm text-brand-ink";
  const sublabel = "text-xs font-normal text-brand-ink/75";
  // Title tier, not Label — a fieldset legend names a group of real content,
  // not chrome, so it shouldn't share the small-caps register table headers use.
  const sectionLegend = "px-1 text-[15px] font-semibold text-brand-ink";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const startDate = String(formData.get("startDate") ?? "");
        const endDate = String(formData.get("endDate") ?? "").trim();
        if (endDate && endDate < startDate) {
          setFormError("End date cannot be before start date.");
          return;
        }

        // Reject unparseable dollar/percent input instead of silently saving $0.
        const numericFields = [
          { label: "Expected spend", value: expectedSpendInput },
          { label: "Host share", value: hostShareInput, max: 100 },
          { label: "Revenue", value: revenueInput },
        ];
        for (const field of numericFields) {
          const raw = field.value.trim();
          if (!raw) continue;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) {
            setFormError(`${field.label} must be a number.`);
            return;
          }
          if (parsed < 0) {
            setFormError(`${field.label} cannot be negative.`);
            return;
          }
          if (field.max !== undefined && parsed > field.max) {
            setFormError(`${field.label} cannot be more than ${field.max}.`);
            return;
          }
        }
        for (const amount of formData.getAll("actualSpendAmount")) {
          const raw = String(amount).trim();
          if (!raw) continue;
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) {
            setFormError("Every actual-spend amount must be a number.");
            return;
          }
          if (parsed < 0) {
            setFormError("Actual-spend amounts cannot be negative.");
            return;
          }
        }

        setFormError(null);
        startTransition(async () => {
          try {
            await saveEventAction(formData);
            onClose();
          } catch (err) {
            setFormError(err instanceof Error ? err.message : "Failed to save event.");
          }
        });
      }}
      className="mx-auto flex max-w-2xl flex-col gap-5 rounded-lg border border-paper-line bg-background p-5 shadow-[var(--shadow-overlay)] md:p-7"
    >
      <input type="hidden" name="semesterId" value={semesterId} />
      {event && <input type="hidden" name="id" value={event.id} />}

      <div className="flex items-center justify-between border-b border-paper-line pb-4">
        <h2 id="event-editor-title" className="text-xl font-bold tracking-tight text-brand-ink">
          {event ? "Edit Event" : "Add Event"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-brand-ink/75 transition-colors hover:text-brand-primary hover:underline"
        >
          Close ✕
        </button>
      </div>

      <label className={label}>
        Name
        <input type="text" name="name" required defaultValue={event?.name} className={input} />
      </label>

      {categories.length === 0 ? (
        <p className="text-sm text-red-600">
          No categories yet — add one from the Categories tab before creating an event.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            Category
            <select
              name="category"
              required
              value={categoryId}
              onChange={(e) => {
                const nextCategoryId = e.target.value;
                setCategoryId(nextCategoryId);
                const nextCategory = categories.find((c) => c.id === nextCategoryId);
                // Host only means anything for another org's category (whose
                // org hosted it). Keep it in sync so it can't silently go stale.
                if (nextCategory?.isOtherOrgCategory) {
                  if (host === chapterName) setHost("");
                } else {
                  setHost(chapterName);
                }
              }}
              className={input}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className={label}>
            Host{selectedCategory?.isOtherOrgCategory && <span className={sublabel}> (which org)</span>}
            <input
              type="text"
              name="host"
              required
              value={host}
              onChange={(e) => setHost(e.target.value)}
              readOnly={!selectedCategory?.isOtherOrgCategory}
              className={`${input} ${!selectedCategory?.isOtherOrgCategory ? "bg-brand-ink/[0.03] text-brand-ink/50" : ""}`}
            />
          </label>
        </div>
      )}

      <fieldset className="flex flex-col gap-4 border-t border-paper-line pt-4">
        <legend className={sectionLegend}>Schedule</legend>

        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            <span className="flex min-h-10 flex-wrap items-baseline gap-1">Start date</span>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={event?.startDate ?? defaultDate}
              className={input}
            />
          </label>
          <label className={label}>
            <span className="flex min-h-10 flex-wrap items-baseline gap-1">
              End date <span className={sublabel}>(multi-day only)</span>
            </span>
            <input type="date" name="endDate" defaultValue={event?.endDate ?? ""} className={input} />
          </label>
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            <span className="flex min-h-10 flex-wrap items-baseline gap-1">
              Start time <span className={sublabel}>(optional)</span>
            </span>
            <input type="time" name="startTime" defaultValue={event?.startTime ?? ""} className={input} />
          </label>
          <label className={label}>
            <span className="flex min-h-10 flex-wrap items-baseline gap-1">
              End time{" "}
              <span className={sublabel}>
                (defaults to +{DEFAULT_DURATION_MINUTES / 60}h)
              </span>
            </span>
            <input type="time" name="endTime" defaultValue={event?.endTime ?? ""} className={input} />
          </label>
        </div>

        <label className={label}>
          Status
          <select
            name="status"
            defaultValue={event?.status ?? "confirmed"}
            className={`w-40 ${input}`}
          >
            <option value="confirmed">Confirmed</option>
            <option value="tentative">Tentative</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="flex flex-col gap-4 border-t border-paper-line pt-4">
        <legend className={sectionLegend}>Budget</legend>

        <span className="text-sm font-bold uppercase tracking-wide text-brand-ink">Expected</span>

        <DrinkCalculator
          categoryId={categoryId}
          categoryLabel={selectedCategory?.label ?? ""}
          presets={drinkPresets}
          groups={drinkItemGroups}
          onUseTotal={(dollars) => setExpectedSpendInput(dollars)}
        />

        {categoryStats && (categoryStats.avgExpectedCents !== null || categoryStats.avgActualCents !== null) && (
          <p className="text-xs text-brand-ink/75">
            {selectedCategory?.label} typically runs{" "}
            {categoryStats.avgExpectedCents !== null && (
              <>
                {centsToDisplay(categoryStats.avgExpectedCents)} expected
                {categoryStats.expectedSampleSize > 1
                  ? ` (avg of ${categoryStats.expectedSampleSize})`
                  : ""}
              </>
            )}
            {categoryStats.avgExpectedCents !== null && categoryStats.avgActualCents !== null && " · "}
            {categoryStats.avgActualCents !== null && (
              <>
                {centsToDisplay(categoryStats.avgActualCents)} actual
                {categoryStats.actualSampleSize > 1
                  ? ` (avg of ${categoryStats.actualSampleSize})`
                  : ""}
              </>
            )}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <label className={label}>
            Expected spend ($)
            <input
              type="number"
              step="0.01"
              min="0"
              name="expectedSpend"
              value={expectedSpendInput}
              onChange={(e) => setExpectedSpendInput(e.target.value)}
              className={input}
            />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-brand-ink">
            <input
              type="checkbox"
              name="expectedSpendApproved"
              defaultChecked={event?.expectedSpendApproval === "approved"}
              className="h-4 w-4 accent-brand-primary"
            />
            Approved
          </label>
        </div>

        {expectedSpendInput && (
          <div className="tabular-figures -mt-2 px-1 text-xs text-brand-ink/75">
            {maxBudgetCents > 0 ? (
              <>
                {thisEventPct}% of cap · Semester total: {centsToDisplay(projectedTotalCents)} (
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

        <div className="border-t border-paper-line pt-3">
          <button
            type="button"
            onClick={() => setShowAdditionalDetails((v) => !v)}
            className="flex w-full items-center justify-between rounded-sm text-sm font-medium text-brand-ink transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
          >
            Additional details
            <span className="text-xs font-normal text-brand-ink/75">
              {showAdditionalDetails ? "Hide" : "Show"}
            </span>
          </button>

          <div
            className={`grid grid-cols-2 gap-4 ${
              showAdditionalDetails ? "mt-3" : "hidden"
            }`}
          >
            <label className={label}>
              Host&apos;s share (%) <span className={sublabel}>(co-hosted only)</span>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                name="hostShareFraction"
                value={hostShareInput}
                onChange={(e) => setHostShareInput(e.target.value)}
                className={input}
              />
            </label>
            <label className={label}>
              Revenue ($) <span className={sublabel}>(revenue-netting categories only)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                name="revenue"
                value={revenueInput}
                onChange={(e) => setRevenueInput(e.target.value)}
                className={input}
              />
            </label>
          </div>
        </div>

        <span className="border-t border-paper-line pt-3 text-sm font-bold uppercase tracking-wide text-brand-ink">
          Actual
        </span>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-brand-ink">Actual spend line items</span>
          {lineItems.map((item, index) => (
            <div key={item.key} className="flex items-center gap-2">
              <input
                type="text"
                name="actualSpendName"
                placeholder="e.g. Photobooth deposit"
                aria-label="Line item name"
                defaultValue={item.name}
                className={`flex-1 ${input}`}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                name="actualSpendAmount"
                placeholder="0.00"
                aria-label="Line item amount"
                defaultValue={item.amountCents ? (item.amountCents / 100).toFixed(2) : ""}
                className={`w-28 ${input}`}
              />
              <button
                type="button"
                onClick={() =>
                  setLineItems((items) => items.filter((_, i) => i !== index))
                }
                className="text-sm text-brand-ink/75 transition-colors hover:text-brand-primary"
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
        <textarea name="notes" rows={3} defaultValue={event?.notes} className={input} />
      </label>

      <div className="flex items-center justify-between border-t border-paper-line pt-5">
        <button
          type="submit"
          disabled={isPending || categories.length === 0}
          className="rounded-sm bg-brand-primary px-4 py-2 text-sm font-semibold text-brand-primary-ink transition-all duration-150 hover:brightness-110 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save event"}
        </button>

        {event && !confirmingDelete && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-sm border border-brand-ink/20 px-4 py-2 text-sm text-brand-ink transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1"
          >
            Delete event
          </button>
        )}

        {event && confirmingDelete && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-brand-ink/75">Delete &quot;{event.name}&quot;?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteEventAction(semesterId, event.id);
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
