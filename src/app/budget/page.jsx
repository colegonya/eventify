import Link from "next/link";
import { getEvents, getEquipmentItems, getCategories } from "@/lib/data";
import { requireSemesters } from "@/lib/setup";
import {
  computeSemesterBudget,
  computeAlerts,
  centsToDisplay,
  pctOfCap,
  alertMessage,
} from "@/lib/budget";
import { equipmentItemsForSemester } from "@/lib/equipment";
import { SemesterSwitcher } from "@/components/SemesterSwitcher";
import { BudgetCategoryPieChart } from "@/components/BudgetCategoryPieChart";
import { EquipmentEditorProvider } from "@/components/EquipmentEditorProvider";
import { AddEquipmentButton } from "@/components/AddEquipmentButton";
import { EquipmentItemLink } from "@/components/EquipmentItemLink";
import { updateMaxBudgetAction } from "@/lib/actions";
import { EQUIPMENT_COLOR } from "@/lib/constants";

export default async function BudgetPage({
  searchParams,
}) {
  const params = await searchParams;
  const semesters = await requireSemesters();

  if (semesters.length === 0) {
    return (
      <div className="p-6">
        <p className="text-brand-ink/75">No semesters yet.</p>
      </div>
    );
  }

  const semester =
    semesters.find((s) => s.id === params.semester) ?? semesters[0];
  const [events, allEquipment, categories] = await Promise.all([
    getEvents(semester.id),
    getEquipmentItems(),
    getCategories(),
  ]);
  const categoriesById = new Map(categories.map((c) => [c.id, c]));
  const equipment = equipmentItemsForSemester(allEquipment, semester.id);
  const eventsOnlyBudget = computeSemesterBudget(events, categoriesById);
  const budget = computeSemesterBudget(events, categoriesById, equipment);
  const alerts = computeAlerts(semester, events, budget, categoriesById, equipment);

  const expectedPct = pctOfCap(budget.expectedSpendCents, semester.maxBudgetCents) ?? 0;
  const actualPct = pctOfCap(budget.actualSpendCents, semester.maxBudgetCents) ?? 0;

  const sortedEvents = events
    .filter(
      (e) =>
        !categoriesById.get(e.category)?.isOtherOrgCategory ||
        e.expectedSpendCents !== null ||
        e.actualSpend.length > 0,
    )
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const eventsById = new Map(events.map((e) => [e.id, e]));

  const categoryTotals = new Map();
  for (const event of events) {
    if (categoriesById.get(event.category)?.excludeFromBudgetTotal) continue;
    const contribution = budget.perEvent.get(event.id);
    if (!contribution) continue;
    const current = categoryTotals.get(event.category) ?? 0;
    categoryTotals.set(event.category, current + contribution.expectedContributionCents);
  }
  const equipmentExpectedTotalCents = equipment.reduce(
    (sum, item) => sum + (budget.perEquipment.get(item.id)?.expectedContributionCents ?? 0),
    0,
  );

  const pieSlices = categories
    .map((category) => ({
      category: category.label,
      amountCents: categoryTotals.get(category.id) ?? 0,
      color: category.color,
    }))
    .concat(
      equipmentExpectedTotalCents > 0
        ? [{ category: "Equipment", amountCents: equipmentExpectedTotalCents, color: EQUIPMENT_COLOR }]
        : [],
    )
    .filter((c) => c.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);
  const pieTotalCents = pieSlices.reduce((sum, c) => sum + c.amountCents, 0);
  const pieSlicesWithPct = pieSlices.map((c) => ({
    ...c,
    pct: pieTotalCents > 0 ? (c.amountCents / pieTotalCents) * 100 : 0,
  }));

  const rows = sortedEvents.map((event) => {
    const contribution = budget.perEvent.get(event.id);
    const capPct =
      event.expectedSpendCents !== null && contribution
        ? pctOfCap(contribution.expectedContributionCents, semester.maxBudgetCents)
        : null;
    return {
      event,
      categoryLabel: categoriesById.get(event.category)?.label ?? "Uncategorized",
      href: `/calendar?semester=${semester.id}&month=${event.startDate.slice(0, 7)}&event=${event.id}`,
      expectedDisplay:
        event.expectedSpendCents === null ? "—" : centsToDisplay(event.expectedSpendCents),
      capPct,
      pending: event.expectedSpendCents !== null && event.expectedSpendApproval === "pending",
      actualDisplay:
        contribution && contribution.baseActualCents > 0
          ? centsToDisplay(contribution.baseActualCents)
          : "—",
    };
  });

  const equipmentRows = [...equipment]
    .sort((a, b) => a.priority - b.priority)
    .map((item) => {
      const contribution = budget.perEquipment.get(item.id);
      const capPct =
        item.expectedCostCents !== null && contribution
          ? pctOfCap(contribution.expectedContributionCents, semester.maxBudgetCents)
          : null;
      return {
        item,
        expectedDisplay:
          item.expectedCostCents === null ? "—" : centsToDisplay(item.expectedCostCents),
        capPct,
        pending: item.expectedCostCents !== null && item.expectedCostApproval === "pending",
        actualDisplay:
          contribution && contribution.baseActualCents > 0
            ? centsToDisplay(contribution.baseActualCents)
            : "—",
      };
    });

  // Everything else counting against the cap this semester, excluding
  // equipment entirely — the equipment editor adds back every other item's
  // own expected cost itself, so this must stay events-only.
  const otherSpendExpectedCents = eventsOnlyBudget.expectedSpendCents;

  return (
    <EquipmentEditorProvider
      items={equipment}
      semesterId={semester.id}
      maxBudgetCents={semester.maxBudgetCents}
      otherSpendExpectedCents={otherSpendExpectedCents}
    >
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SemesterSwitcher
          semesters={semesters}
          selectedId={semester.id}
          basePath="/budget"
        />

        <form
          action={updateMaxBudgetAction}
          className="flex items-center gap-2 rounded-lg border border-brand-ink/15 bg-white px-3 py-1.5 text-sm shadow-sm"
        >
          <input type="hidden" name="semesterId" value={semester.id} />
          <label className="text-brand-ink/75">Max budget ($)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            name="maxBudget"
            defaultValue={(semester.maxBudgetCents / 100).toFixed(2)}
            className="w-28 rounded-md border border-brand-ink/20 px-2 py-1 outline-none focus:border-brand-primary"
          />
          <button
            type="submit"
            className="rounded-md border border-brand-ink/20 px-3 py-1 text-brand-ink hover:bg-brand-ink/5"
          >
            Save
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-brand-ink/10 bg-white p-5 shadow-sm">
          <div className="text-sm text-brand-ink/75">Semester Expected Spend</div>
          <div className="mt-1 text-3xl font-semibold text-brand-ink">
            {centsToDisplay(budget.expectedSpendCents)}
          </div>
          <div className="mt-1 text-xs text-brand-ink/75">
            {expectedPct}% of {centsToDisplay(semester.maxBudgetCents)} cap
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/10">
            <div
              className={`h-full ${expectedPct >= 90 ? "bg-red-600" : "bg-brand-primary"}`}
              style={{ width: `${Math.min(expectedPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-brand-ink/10 bg-white p-5 shadow-sm">
          <div className="text-sm text-brand-ink/75">Semester Actual Spend</div>
          <div className="mt-1 text-3xl font-semibold text-brand-ink">
            {centsToDisplay(budget.actualSpendCents)}
          </div>
          <div className="mt-1 text-xs text-brand-ink/75">
            {actualPct}% of {centsToDisplay(semester.maxBudgetCents)} cap
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-brand-ink/10">
            <div
              className={`h-full ${actualPct >= 90 ? "bg-red-600" : "bg-brand-primary"}`}
              style={{ width: `${Math.min(actualPct, 100)}%` }}
            />
          </div>
        </div>
      </div>

      <BudgetCategoryPieChart slices={pieSlicesWithPct} totalCents={pieTotalCents} />

      {alerts.length > 0 && (
        <details className="group rounded-xl border border-amber-300/60 bg-amber-50/60 open:bg-amber-50">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-amber-900 marker:content-none">
            <span aria-hidden className="text-amber-600">⚠</span>
            {alerts.length} {alerts.length === 1 ? "item needs" : "items need"} attention
            <span className="ml-auto text-xs text-amber-800 group-open:hidden">show</span>
            <span className="ml-auto hidden text-xs text-amber-800 group-open:inline">hide</span>
          </summary>
          <div className="flex flex-col gap-1 border-t border-amber-300/40 px-4 py-3 text-sm text-amber-900">
            {alerts.map((alert, i) => {
              const message = alertMessage(alert);
              const linkedEvent = "eventId" in alert ? eventsById.get(alert.eventId) : undefined;
              if (linkedEvent) {
                return (
                  <Link
                    key={i}
                    href={`/calendar?semester=${semester.id}&month=${linkedEvent.startDate.slice(0, 7)}&event=${linkedEvent.id}`}
                    className="block hover:text-brand-primary hover:underline"
                  >
                    {message}
                  </Link>
                );
              }
              if ("equipmentId" in alert) {
                return (
                  <EquipmentItemLink
                    key={i}
                    id={alert.equipmentId}
                    className="block text-left hover:text-brand-primary hover:underline"
                  >
                    {message}
                  </EquipmentItemLink>
                );
              }
              return <div key={i}>{message}</div>;
            })}
          </div>
        </details>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-brand-ink">Per-event detail</h2>

        {/* Desktop/tablet: table. Below md, a table squishes badges and names — use cards instead. */}
        <div className="hidden overflow-hidden rounded-xl border border-brand-ink/10 bg-white shadow-sm md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-ink/10 bg-brand-ink/[0.03] text-left text-brand-ink/75">
                <th className="p-3 font-medium">Event</th>
                <th className="p-3 font-medium">Category</th>
                <th className="p-3 font-medium">Expected</th>
                <th className="p-3 font-medium">Actual</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.event.id}
                  className={`border-b border-brand-ink/5 last:border-0 ${i % 2 === 1 ? "bg-brand-ink/[0.015]" : ""}`}
                >
                  <td className="p-3">
                    <Link href={row.href} className="text-brand-ink hover:text-brand-primary hover:underline">
                      {row.event.name}
                    </Link>
                  </td>
                  <td className="p-3 text-brand-ink/75">{row.categoryLabel}</td>
                  <td className="p-3 text-brand-ink/75">
                    {row.expectedDisplay}
                    {row.capPct !== null && (
                      <span
                        className="ml-1.5 rounded-full bg-brand-ink/[0.06] px-1.5 py-0.5 text-[11px] text-brand-ink/75"
                        title="Share of the semester max budget"
                      >
                        {row.capPct}%
                      </span>
                    )}
                    {row.pending && (
                      <span className="ml-1.5 rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[11px] text-brand-accent-deep">
                        pending approval
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-brand-ink/75">{row.actualDisplay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 md:hidden">
          {rows.map((row) => (
            <div
              key={row.event.id}
              className="rounded-xl border border-brand-ink/10 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={row.href}
                  className="font-medium text-brand-ink hover:text-brand-primary hover:underline"
                >
                  {row.event.name}
                </Link>
                <span className="shrink-0 pt-0.5 text-xs text-brand-ink/75">{row.categoryLabel}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-ink/75">
                <span>Expected: {row.expectedDisplay}</span>
                <span>Actual: {row.actualDisplay}</span>
              </div>
              {(row.capPct !== null || row.pending) && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {row.capPct !== null && (
                    <span
                      className="rounded-full bg-brand-ink/[0.06] px-1.5 py-0.5 text-[11px] text-brand-ink/75"
                      title="Share of the semester max budget"
                    >
                      {row.capPct}% of cap
                    </span>
                  )}
                  {row.pending && (
                    <span className="rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[11px] text-brand-accent-deep">
                      pending approval
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-brand-ink">Equipment</h2>
          <AddEquipmentButton />
        </div>

        {equipmentRows.length === 0 ? (
          <div className="rounded-xl border border-brand-ink/10 bg-white p-5 text-sm text-brand-ink/50 shadow-sm">
            No equipment on the wishlist yet.
          </div>
        ) : (
          <>
            {/* Desktop/tablet: table. Below md, a table squishes badges and names — use cards instead. */}
            <div className="hidden overflow-hidden rounded-xl border border-brand-ink/10 bg-white shadow-sm md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-ink/10 bg-brand-ink/[0.03] text-left text-brand-ink/60">
                    <th className="p-3 font-medium">Item</th>
                    <th className="p-3 font-medium">Expected</th>
                    <th className="p-3 font-medium">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {equipmentRows.map((row, i) => (
                    <tr
                      key={row.item.id}
                      className={`border-b border-brand-ink/5 last:border-0 ${i % 2 === 1 ? "bg-brand-ink/[0.015]" : ""}`}
                    >
                      <td className="p-3">
                        <EquipmentItemLink
                          id={row.item.id}
                          className="text-left text-brand-ink hover:text-brand-primary hover:underline"
                        >
                          {row.item.name}
                        </EquipmentItemLink>
                        {row.item.link && (
                          <a
                            href={row.item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-1.5 text-xs text-brand-ink/40 hover:text-brand-primary"
                          >
                            link ↗
                          </a>
                        )}
                      </td>
                      <td className="p-3 text-brand-ink/70">
                        {row.expectedDisplay}
                        {row.capPct !== null && (
                          <span
                            className="ml-1.5 rounded-full bg-brand-ink/[0.06] px-1.5 py-0.5 text-[11px] text-brand-ink/60"
                            title="Share of the semester max budget"
                          >
                            {row.capPct}%
                          </span>
                        )}
                        {row.pending && (
                          <span className="ml-1.5 rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[11px] text-brand-accent-deep">
                            pending approval
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-brand-ink/70">{row.actualDisplay}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 md:hidden">
              {equipmentRows.map((row) => (
                <div
                  key={row.item.id}
                  className="rounded-xl border border-brand-ink/10 bg-white p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <EquipmentItemLink
                      id={row.item.id}
                      className="text-left font-medium text-brand-ink hover:text-brand-primary hover:underline"
                    >
                      {row.item.name}
                    </EquipmentItemLink>
                    {row.item.link && (
                      <a
                        href={row.item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 pt-0.5 text-xs text-brand-ink/40 hover:text-brand-primary"
                      >
                        link ↗
                      </a>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-brand-ink/70">
                    <span>Expected: {row.expectedDisplay}</span>
                    <span>Actual: {row.actualDisplay}</span>
                  </div>
                  {(row.capPct !== null || row.pending) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {row.capPct !== null && (
                        <span
                          className="rounded-full bg-brand-ink/[0.06] px-1.5 py-0.5 text-[11px] text-brand-ink/60"
                          title="Share of the semester max budget"
                        >
                          {row.capPct}% of cap
                        </span>
                      )}
                      {row.pending && (
                        <span className="rounded-full bg-brand-accent/15 px-1.5 py-0.5 text-[11px] text-brand-accent-deep">
                          pending approval
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
    </EquipmentEditorProvider>
  );
}
