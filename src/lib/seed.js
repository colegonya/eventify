import { DEFAULT_CHAPTER_NAME } from "@/lib/config";

// Example data only — every value here is fictional. It's written to a new
// deployment only if the chapter asks for it at /setup, so they can look
// around a populated app before committing; edit or delete all of it from the
// Calendar/Contacts/Categories tabs whenever. The category set and drink
// presets below are different: those are real defaults every deployment gets,
// since an event has to pick a category from somewhere. See ensureDefaults()
// and seedExampleData() in data.js.

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
    host: DEFAULT_CHAPTER_NAME,
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

// Starting drink catalog for the Drinks tab. Groups and items are data the
// chapter owns — rename, reprice, delete, or add to any of it. The slug ids
// are stable so DEFAULT_DRINK_PRESETS below can reference items by id.
export const DEFAULT_DRINK_GROUPS = [
  {
    id: "liquor",
    label: "Liquor",
    items: [
      { id: "cooks-champagne", name: "Cook's Champagne", price: 10.09 },
      { id: "vodka-1-5l", name: "1.5L Vodka", price: 14.79 },
      { id: "tequila-blanco-1-75l", name: "1.75L Tequila Blanco", price: 27.49 },
    ],
  },
  {
    id: "beer-seltzer",
    label: "Beer & Seltzer",
    items: [
      { id: "coors-36", name: "36 Coors", price: 29.0 },
      { id: "seltzers-24", name: "24 Seltzers", price: 23.59 },
    ],
  },
  {
    id: "mixers",
    label: "Mixers",
    items: [
      { id: "cranberry-juice-2", name: "2 Jugs Cranberry Juice", price: 9.86 },
      { id: "orange-juice-2gal", name: "2 1-Gal Jugs Orange Juice", price: 18.38 },
    ],
  },
  {
    id: "cups",
    label: "Cups",
    items: [{ id: "red-solo-cups-240", name: "240 Red Solo Cups", price: 13.04 }],
  },
];

// Default "typical order" per category for the Drink & supply calculator's
// Autofill button, keyed by the starter category ids above and the item ids
// from DEFAULT_DRINK_GROUPS. A category with no realistic drink budget
// (Philanthropy, Other Org Event, Recruitment) is left out, so Autofill
// doesn't show for it.
export const DEFAULT_DRINK_PRESETS = {
  mixer: { "cooks-champagne": 6, "vodka-1-5l": 2, "seltzers-24": 2, "red-solo-cups-240": 3 },
  party: {
    "vodka-1-5l": 6,
    "tequila-blanco-1-75l": 3,
    "coors-36": 6,
    "seltzers-24": 4,
    "cranberry-juice-2": 4,
    "orange-juice-2gal": 4,
    "red-solo-cups-240": 6,
  },
  darty: {
    "coors-36": 10,
    "seltzers-24": 5,
    "vodka-1-5l": 2,
    "cranberry-juice-2": 2,
    "orange-juice-2gal": 2,
    "red-solo-cups-240": 4,
  },
  "club-party": {
    "coors-36": 8,
    "seltzers-24": 4,
    "vodka-1-5l": 4,
    "cranberry-juice-2": 2,
    "orange-juice-2gal": 2,
    "red-solo-cups-240": 5,
  },
  retreat: { "coors-36": 4, "red-solo-cups-240": 1 },
  "chapter-event": { "coors-36": 8, "seltzers-24": 4, "red-solo-cups-240": 2 },
  formal: { "cooks-champagne": 10, "seltzers-24": 3, "red-solo-cups-240": 3 },
};
