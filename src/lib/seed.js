import { CHAPTER_NAME } from "@/lib/config";

// First-run example data only — every value here is fictional. It seeds an
// empty deployment so the app isn't a blank page on first load; edit or
// delete all of it from the Calendar/Contacts/Categories tabs once you're
// running your own chapter's data. See ensureSeeded() in data.ts.

export const STARTER_SEMESTER = {
  id: "example-semester",
  label: "Example Semester",
  startDate: "2026-08-24",
  endDate: "2026-12-12",
  maxBudgetCents: 1_000_000,
};

export const STARTER_GAME_DAYS = [
  { id: "example-gd-1", semesterId: "example-semester", opponent: "Example University", date: "2026-09-06" },
  { id: "example-gd-2", semesterId: "example-semester", opponent: "Rival State (Homecoming)", date: "2026-10-11" },
];

// Every category a chapter sees is data they own (see the Categories tab) —
// this is just a sensible starting palette, fully editable and deletable.
export const STARTER_CATEGORIES = [
  { id: "mixer", label: "Mixer", color: "#3b82f6", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "party", label: "Party", color: "#dc2626", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "darty", label: "Darty", color: "#eab308", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "formal", label: "Formal", color: "#ec4899", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "philanthropy", label: "Philanthropy", color: "#9333ea", netsRevenue: true, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "club-party", label: "Club Party", color: "#16a34a", netsRevenue: true, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "retreat", label: "Retreat", color: "#0d9488", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "chapter-event", label: "Chapter Event", color: "#92400e", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
  { id: "other-org-event", label: "Other Org Event", color: "#64748b", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: true },
  { id: "recruitment", label: "Recruitment", color: "#4f46e5", netsRevenue: false, excludeFromBudgetTotal: true, isOtherOrgCategory: false },
];

function event(
  overrides,
) {
  return {
    semesterId: "example-semester",
    host: CHAPTER_NAME,
    endDate: overrides.startDate,
    startTime: null,
    endTime: null,
    status: "confirmed",
    expectedSpendCents: null,
    expectedSpendApproval: "pending",
    actualSpend: [],
    hostShareFraction: null,
    revenueCents: null,
    notes: "",
    ...overrides,
  };
}

export const STARTER_EVENTS = [
  event({
    id: "example-welcome-mixer",
    name: "Welcome Mixer",
    category: "mixer",
    startDate: "2026-09-03",
    expectedSpendCents: 70_000,
    notes: "Example event — edit or delete me.",
  }),
  event({
    id: "example-game-day-darty",
    name: "Game Day Darty",
    category: "darty",
    startDate: "2026-09-06",
    expectedSpendCents: 90_000,
  }),
  event({
    id: "example-fundraiser",
    name: "Example Philanthropy Fundraiser",
    category: "philanthropy",
    startDate: "2026-09-13",
    expectedSpendCents: 20_000,
    revenueCents: 20_000,
    notes: "Nets to $0 — cost and revenue cancel out. Try editing the revenue field.",
  }),
  event({
    id: "example-cohosted-mixer",
    name: "Co-Hosted Mixer",
    category: "mixer",
    startDate: "2026-09-17",
    expectedSpendCents: 100_000,
    hostShareFraction: 0.5,
    notes: "Example of a co-hosted event — only 50% of the cost counts toward your budget.",
  }),
  event({
    id: "example-other-org-event",
    name: "Rival Chapter's Philanthropy Event",
    category: "other-org-event",
    host: "Example Fraternity",
    startDate: "2026-09-20",
    notes: "Example of another org's event — doesn't count toward your budget or calendar export.",
  }),
  event({
    id: "example-recruitment-week",
    name: "Recruitment Week",
    category: "recruitment",
    startDate: "2026-09-24",
    endDate: "2026-09-27",
    notes: "Example of a category excluded from budget totals.",
  }),
  event({
    id: "example-club-party",
    name: "Example Club Party",
    category: "club-party",
    startDate: "2026-10-10",
    expectedSpendCents: 150_000,
    revenueCents: 60_000,
  }),
  event({
    id: "example-retreat",
    name: "Chapter Retreat",
    category: "retreat",
    startDate: "2026-10-16",
    endDate: "2026-10-18",
  }),
  event({
    id: "example-date-party",
    name: "Fall Date Party",
    category: "party",
    startDate: "2026-10-24",
  }),
  event({
    id: "example-formal",
    name: "Formal",
    category: "formal",
    startDate: "2026-12-05",
  }),
];

function contact(
  overrides,
) {
  return {
    semesterId: "example-semester",
    phone: "",
    meetingDate: null,
    notes: "",
    ...overrides,
  };
}

export const STARTER_CONTACTS = [
  contact({
    id: "example-contact-1",
    org: "Example Sorority A",
    position: "Jane Doe",
    status: "Responded/Meeting Set",
    phone: "(555) 010-0001",
  }),
  contact({
    id: "example-contact-2",
    org: "Example Sorority B",
    position: "Social Chair",
    status: "Reached Out",
    phone: "(555) 010-0002",
  }),
  contact({
    id: "example-contact-3",
    org: "Partner Fraternity",
    position: "Alex Smith",
    status: "Not Reached Out",
  }),
];

// Default "typical order" per category for the Drink & supply calculator's
// Autofill button, keyed by the starter category ids above. A category with
// no realistic drink budget (Philanthropy, Other Org Event, Recruitment) is
// left out, so Autofill doesn't show for it.
export const DEFAULT_DRINK_PRESETS = {
  mixer: { "Cook's Champagne": 6, "1.5L Vodka": 2, "24 Seltzers": 2, "240 Red Solo Cups": 3 },
  party: {
    "1.5L Vodka": 6,
    "1.75L Tequila Blanco": 3,
    "36 Coors": 6,
    "24 Seltzers": 4,
    "2 Jugs Cranberry Juice": 4,
    "2 1-Gal Jugs Orange Juice": 4,
    "240 Red Solo Cups": 6,
  },
  darty: {
    "36 Coors": 10,
    "24 Seltzers": 5,
    "1.5L Vodka": 2,
    "2 Jugs Cranberry Juice": 2,
    "2 1-Gal Jugs Orange Juice": 2,
    "240 Red Solo Cups": 4,
  },
  "club-party": {
    "36 Coors": 8,
    "24 Seltzers": 4,
    "1.5L Vodka": 4,
    "2 Jugs Cranberry Juice": 2,
    "2 1-Gal Jugs Orange Juice": 2,
    "240 Red Solo Cups": 5,
  },
  retreat: { "36 Coors": 4, "240 Red Solo Cups": 1 },
  "chapter-event": { "36 Coors": 8, "24 Seltzers": 4, "240 Red Solo Cups": 2 },
  formal: { "Cook's Champagne": 10, "24 Seltzers": 3, "240 Red Solo Cups": 3 },
};
