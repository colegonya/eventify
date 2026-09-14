import { describe, it, expect } from "vitest";
import {
  computeSemesterBudget,
  computeAlerts,
  needsBudgetApproval,
  isExpectedSpendPending,
  capSharePct,
} from "@/lib/budget";

const categories = [
  { id: "darty", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "mixer", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "philanthropy", netsRevenue: true, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "rush", netsRevenue: false, excludeFromBudgetTotal: true, isOtherOrgCategory: false },
  { id: "other-org", netsRevenue: false, excludeFromBudgetTotal: true, isOtherOrgCategory: true },
];
const categoriesById = new Map(categories.map((c) => [c.id, c]));

const event = (overrides) => ({
  name: "Event",
  expectedSpendCents: null,
  actualSpend: [],
  hostShareFraction: null,
  revenueCents: null,
  ...overrides,
});

describe("computeSemesterBudget", () => {
  it("nets revenue, applies the co-host share, and leaves excluded categories out of the total", () => {
    const events = [
      event({ id: "darty", category: "darty", expectedSpendCents: 75000, actualSpend: [{ amountCents: 80000 }] }),
      event({ id: "philo", category: "philanthropy", expectedSpendCents: 10000, revenueCents: 10000 }),
      event({ id: "rush", category: "rush", expectedSpendCents: 70000 }),
      event({ id: "mixer", category: "mixer", expectedSpendCents: 100000, hostShareFraction: 0.5 }),
    ];

    const budget = computeSemesterBudget(events, categoriesById);

    // 75000 darty + 0 philanthropy (cost cancelled by revenue) + 50000 half-share mixer.
    // The 70000 rush event is excluded from the total entirely.
    expect(budget.expectedSpendCents).toBe(125000);
    expect(budget.perEvent.get("mixer").expectedContributionCents).toBe(50000);
    expect(budget.perEvent.get("rush").expectedContributionCents).toBe(70000);
  });

  it("subtracts revenue from actual spend too, even before any cost is recorded", () => {
    // A single revenueCents field nets against BOTH expected and actual, so a
    // projected fundraiser drives reported actual spend negative before a dollar
    // is collected. Pinning it here so splitting the field stays a deliberate change.
    const events = [event({ id: "philo", category: "philanthropy", expectedSpendCents: 10000, revenueCents: 10000 })];

    const budget = computeSemesterBudget(events, categoriesById);

    expect(budget.actualSpendCents).toBe(-10000);
  });
});

describe("computeAlerts", () => {
  it("flags going over the cap and skips other-org events when reporting missing spend", () => {
    const events = [
      event({ id: "mixer", name: "Mixer", category: "mixer", expectedSpendCents: 125000 }),
      event({ id: "unpriced", name: "Formal", category: "mixer", expectedSpendCents: null }),
      event({ id: "theirs", name: "Rival Party", category: "other-org", expectedSpendCents: null }),
    ];
    const budget = computeSemesterBudget(events, categoriesById);

    const alerts = computeAlerts({ maxBudgetCents: 100000 }, events, budget, categoriesById);

    expect(alerts).toContainEqual({ type: "cap-expected" });
    expect(alerts).toContainEqual({ type: "missing-expected", eventId: "unpriced", eventName: "Formal" });
    expect(alerts.some((a) => a.eventId === "theirs")).toBe(false);
  });
});

describe("isExpectedSpendPending", () => {
  it("never reports a pending approval for a category excluded from the budget", () => {
    const rushEvent = event({
      id: "rush",
      category: "rush",
      expectedSpendCents: 70000,
      expectedSpendApproval: "pending",
    });

    expect(needsBudgetApproval(categoriesById.get("rush"))).toBe(false);
    expect(isExpectedSpendPending(rushEvent, categoriesById.get("rush"))).toBe(false);
  });

  it("reports a pending approval for a budgeted category with spend entered", () => {
    const mixerEvent = event({
      id: "mixer",
      category: "mixer",
      expectedSpendCents: 70000,
      expectedSpendApproval: "pending",
    });

    expect(needsBudgetApproval(categoriesById.get("mixer"))).toBe(true);
    expect(isExpectedSpendPending(mixerEvent, categoriesById.get("mixer"))).toBe(true);
  });

  it("stays quiet until an expected spend is entered, and once approved", () => {
    const base = { id: "mixer", category: "mixer" };
    const category = categoriesById.get("mixer");

    expect(
      isExpectedSpendPending(event({ ...base, expectedSpendApproval: "pending" }), category),
    ).toBe(false);
    expect(
      isExpectedSpendPending(
        event({ ...base, expectedSpendCents: 70000, expectedSpendApproval: "approved" }),
        category,
      ),
    ).toBe(false);
  });
});

describe("capSharePct", () => {
  const maxBudgetCents = 900000;

  it("hides the share for an excluded category and for a zero contribution", () => {
    expect(capSharePct(70000, maxBudgetCents, categoriesById.get("rush"))).toBe(null);
    expect(capSharePct(0, maxBudgetCents, categoriesById.get("mixer"))).toBe(null);
    expect(capSharePct(null, maxBudgetCents, categoriesById.get("mixer"))).toBe(null);
  });

  it("applies the zero rule to equipment, which is passed no category", () => {
    expect(capSharePct(0, maxBudgetCents)).toBe(null);
    expect(capSharePct(90000, maxBudgetCents)).toBe(10);
  });

  it("reports the share for a budgeted category, negative contributions included", () => {
    expect(capSharePct(90000, maxBudgetCents, categoriesById.get("mixer"))).toBe(10);
    expect(capSharePct(-90000, maxBudgetCents, categoriesById.get("philanthropy"))).toBe(-10);
  });
});
