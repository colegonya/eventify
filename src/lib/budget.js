function sumActualSpend(event) {
  return event.actualSpend.reduce((sum, item) => sum + item.amountCents, 0);
}

export function computeContribution(input) {
  const shareFactor = input.hostShareFraction ?? 1;
  const revenueCents = input.revenueCents ?? 0;

  let expectedCost = (input.expectedSpendCents ?? 0) * shareFactor;
  let actualCost = input.actualSpendCents * shareFactor;

  if (input.netsRevenue) {
    expectedCost -= revenueCents;
    actualCost -= revenueCents;
  }

  return {
    expectedContributionCents: expectedCost,
    actualContributionCents: actualCost,
  };
}

export function computeEventContribution(
  event,
  categoriesById,
) {
  const baseExpectedCents = event.expectedSpendCents;
  const baseActualCents = sumActualSpend(event);
  const category = categoriesById.get(event.category);

  const contribution = computeContribution({
    netsRevenue: category?.netsRevenue ?? false,
    expectedSpendCents: baseExpectedCents,
    actualSpendCents: baseActualCents,
    hostShareFraction: event.hostShareFraction,
    revenueCents: event.revenueCents,
  });

  return {
    eventId: event.id,
    baseExpectedCents,
    baseActualCents,
    expectedContributionCents: contribution.expectedContributionCents,
    actualContributionCents: contribution.actualContributionCents,
  };
}

export function pctOfCap(cents, maxBudgetCents) {
  return maxBudgetCents > 0 ? Math.round((cents / maxBudgetCents) * 100) : null;
}

// A category's own excludeFromBudgetTotal flag drives this now — see
// types/category.ts — rather than a fixed set of category names.
export function isExcludedFromBudgetTotal(category) {
  return category?.excludeFromBudgetTotal ?? false;
}

// Unlike events, equipment has no co-host share or revenue to net out — its
// contribution is just its own cost.
export function computeEquipmentContribution(item) {
  const baseExpectedCents = item.expectedCostCents;
  const baseActualCents = item.actualSpend.reduce((sum, line) => sum + line.amountCents, 0);

  return {
    itemId: item.id,
    baseExpectedCents,
    baseActualCents,
    expectedContributionCents: baseExpectedCents ?? 0,
    actualContributionCents: baseActualCents,
  };
}

export function computeSemesterBudget(
  events,
  categoriesById,
  equipmentItems = [],
) {
  const perEvent = new Map();
  const perEquipment = new Map();
  let expectedSpendCents = 0;
  let actualSpendCents = 0;

  for (const event of events) {
    const contribution = computeEventContribution(event, categoriesById);
    perEvent.set(event.id, contribution);
    if (!isExcludedFromBudgetTotal(categoriesById.get(event.category))) {
      expectedSpendCents += contribution.expectedContributionCents;
      actualSpendCents += contribution.actualContributionCents;
    }
  }

  for (const item of equipmentItems) {
    const contribution = computeEquipmentContribution(item);
    perEquipment.set(item.id, contribution);
    expectedSpendCents += contribution.expectedContributionCents;
    actualSpendCents += contribution.actualContributionCents;
  }

  return { expectedSpendCents, actualSpendCents, perEvent, perEquipment };
}

export function alertMessage(alert) {
  switch (alert.type) {
    case "cap-expected":
      return "Semester Expected Spend has gone over the max budget.";
    case "cap-actual":
      return "Semester Actual Spend has hit 90% of the max budget.";
    case "over-budget":
      return `"${alert.eventName}" has spent more than its expected budget.`;
    case "missing-expected":
      return `"${alert.eventName}" has no expected spend entered yet.`;
    case "equipment-over-budget":
      return `"${alert.equipmentName}" has spent more than its expected cost.`;
    case "equipment-missing-expected":
      return `"${alert.equipmentName}" has no expected cost entered yet.`;
  }
}

const CAP_WARNING_THRESHOLD = 0.9;

export function computeAlerts(
  semester,
  events,
  budget,
  categoriesById,
  equipmentItems = [],
) {
  const alerts = [];

  if (semester.maxBudgetCents > 0) {
    if (budget.expectedSpendCents > semester.maxBudgetCents) {
      alerts.push({ type: "cap-expected" });
    }
    if (budget.actualSpendCents >= semester.maxBudgetCents * CAP_WARNING_THRESHOLD) {
      alerts.push({ type: "cap-actual" });
    }
  }

  for (const event of events) {
    const category = categoriesById.get(event.category);
    if (category?.isOtherOrgCategory || category?.excludeFromBudgetTotal) continue;

    const contribution = budget.perEvent.get(event.id);
    if (!contribution) continue;

    if (
      contribution.baseExpectedCents !== null &&
      contribution.baseActualCents > contribution.baseExpectedCents
    ) {
      alerts.push({ type: "over-budget", eventId: event.id, eventName: event.name });
    }
    if (contribution.baseExpectedCents === null) {
      alerts.push({ type: "missing-expected", eventId: event.id, eventName: event.name });
    }
  }

  for (const item of equipmentItems) {
    const contribution = budget.perEquipment.get(item.id);
    if (!contribution) continue;

    if (
      contribution.baseExpectedCents !== null &&
      contribution.baseActualCents > contribution.baseExpectedCents
    ) {
      alerts.push({ type: "equipment-over-budget", equipmentId: item.id, equipmentName: item.name });
    }
    if (contribution.baseExpectedCents === null) {
      alerts.push({ type: "equipment-missing-expected", equipmentId: item.id, equipmentName: item.name });
    }
  }

  return alerts;
}

// Typical spend per category, across all semesters, for the "what does this
// usually cost" hint on the event form. Uses each event's own entered
// figures (not co-host/revenue-netted contribution), since the question is
// "what did this event cost," not "what did it cost the host chapter."
export function computeCategorySpendStats(
  events,
) {
  const stats = new Map();

  for (const event of events) {
    const current = stats.get(event.category) ?? {
      avgExpectedCents: null,
      expectedSampleSize: 0,
      avgActualCents: null,
      actualSampleSize: 0,
    };

    if (event.expectedSpendCents !== null) {
      const total = (current.avgExpectedCents ?? 0) * current.expectedSampleSize;
      current.expectedSampleSize += 1;
      current.avgExpectedCents = (total + event.expectedSpendCents) / current.expectedSampleSize;
    }

    if (event.actualSpend.length > 0) {
      const actualCents = sumActualSpend(event);
      const total = (current.avgActualCents ?? 0) * current.actualSampleSize;
      current.actualSampleSize += 1;
      current.avgActualCents = (total + actualCents) / current.actualSampleSize;
    }

    stats.set(event.category, current);
  }

  return stats;
}

export function centsToDisplay(cents) {
  const dollars = cents / 100;
  const sign = dollars < 0 ? "-" : "";
  return `${sign}$${Math.abs(dollars).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
