"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  saveEvent,
  deleteEvent as deleteEventRecord,
  getEvents,
  getSemester,
  getSemesters,
  getSemestersFresh,
  getBrandingSettings,
  saveBrandingSettings,
  renameChapterInEventHosts,
  saveSemester,
  deleteSemester as deleteSemesterRecord,
  seedExampleData,
  saveContacts,
  saveDrinkPresets,
  getDrinkGroups,
  saveDrinkGroups,
  addDrinkItemToGroup,
  getEquipmentItems,
  saveEquipmentItem,
  deleteEquipmentItem as deleteEquipmentItemRecord,
  saveCategories,
  getCategories,
  dismissOnboardingChecklist,
} from "@/lib/data";
import { parseISODate, formatISODate, addDays } from "@/lib/dates";
import {
  AUTH_COOKIE_NAME,
  expectedAuthCookieValue,
  isValidPasscode,
  setPasscode,
  MIN_PASSCODE_LENGTH,
} from "@/lib/auth";
import { BRAND_COLOR_VARS } from "@/lib/config";

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 180,
};

export async function loginAction(formData) {
  const passcode = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/calendar");

  if (!(await isValidPasscode(passcode))) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, await expectedAuthCookieValue(), AUTH_COOKIE_OPTIONS);

  redirect(next);
}

/**
 * Rotates the shared passcode. Every other logged-in browser is signed out,
 * since their cookie holds the old hash — which is exactly what you want after
 * exec turnover or a leak. The officer doing the rotating gets a fresh cookie
 * so they aren't kicked out of the page they're standing on.
 */
export async function updatePasscodeAction(formData) {
  const passcode = String(formData.get("passcode") ?? "");
  const confirmation = String(formData.get("passcodeConfirm") ?? "");

  if (passcode.length < MIN_PASSCODE_LENGTH) redirect("/settings?error=passcodeShort");
  if (passcode !== confirmation) redirect("/settings?error=passcodeMismatch");

  const value = await setPasscode(passcode);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, value, AUTH_COOKIE_OPTIONS);

  redirect("/settings?saved=passcode");
}

function parseDollarsToCents(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const dollars = Number.parseFloat(value);
  if (Number.isNaN(dollars)) return null;
  return Math.round(dollars * 100);
}

function parseActualSpend(formData) {
  const names = formData.getAll("actualSpendName");
  const amounts = formData.getAll("actualSpendAmount");
  const items = [];
  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] ?? "").trim();
    const amountCents = parseDollarsToCents(amounts[i] ?? null);
    if (!name || amountCents === null) continue;
    items.push({ id: crypto.randomUUID(), name, amountCents });
  }
  return items;
}

export async function saveEventAction(formData) {
  const semesterId = String(formData.get("semesterId"));
  const id = String(formData.get("id") || crypto.randomUUID());
  const startDate = String(formData.get("startDate"));
  const endDateRaw = String(formData.get("endDate") ?? "").trim();
  const endDate = endDateRaw || startDate;
  if (endDate < startDate) {
    throw new Error("End date cannot be before start date.");
  }
  const hostShareFractionRaw = String(formData.get("hostShareFraction") ?? "").trim();

  const category = String(formData.get("category") ?? "");
  const [categories, { chapterName }] = await Promise.all([getCategories(), getBrandingSettings()]);
  const matchedCategory = categories.find((c) => c.id === category);

  // The host field is read-only in the UI for every category except "other
  // org" ones — for the chapter's own events, host is always meant to be the
  // chapter itself, not something an officer picks. A readOnly input still
  // submits its current value (unlike disabled), so a form left open across
  // a chapter rename in another tab could submit a stale name. Resolve it
  // fresh instead of trusting the client — but only once the category is
  // positively confirmed to NOT be an other-org one. Categories are global
  // and can be deleted at any time; if this event's category no longer
  // exists (deleted after the form loaded, or a bad id), we can't tell which
  // kind it was meant to be, so fall back to trusting the submitted host
  // rather than guessing "not other-org" and silently overwriting a real
  // custom host with the chapter's own name.
  const host =
    matchedCategory && !matchedCategory.isOtherOrgCategory
      ? chapterName
      : String(formData.get("host") ?? "").trim() || chapterName;

  const event = {
    id,
    semesterId,
    name: String(formData.get("name") ?? "").trim(),
    category,
    host,
    startDate,
    endDate,
    startTime: (formData.get("startTime")) || null,
    endTime: (formData.get("endTime")) || null,
    status: (formData.get("status")) ?? "confirmed",
    expectedSpendCents: parseDollarsToCents(formData.get("expectedSpend")),
    expectedSpendApproval: formData.get("expectedSpendApproved")
      ? "approved"
      : "pending",
    actualSpend: parseActualSpend(formData),
    hostShareFraction: hostShareFractionRaw
      ? Number.parseFloat(hostShareFractionRaw) / 100
      : null,
    revenueCents: parseDollarsToCents(formData.get("revenue")),
    notes: String(formData.get("notes") ?? ""),
  };

  await saveEvent(event);
  revalidatePath("/calendar");
  revalidatePath("/budget");
}

/**
 * Reschedules an event by drag-and-drop. `fromDate`/`toDate` are the grabbed
 * day and the drop day; the event's start and end both shift by that delta so
 * a multi-day event keeps its duration regardless of which day was grabbed.
 */
export async function moveEventAction(
  semesterId,
  eventId,
  fromDate,
  toDate,
) {
  if (fromDate === toDate) return;

  const events = await getEvents(semesterId);
  const event = events.find((e) => e.id === eventId);
  if (!event) return;

  const MS_PER_DAY = 86_400_000;
  const deltaDays = Math.round(
    (parseISODate(toDate).getTime() - parseISODate(fromDate).getTime()) / MS_PER_DAY,
  );
  if (deltaDays === 0) return;

  const shift = (iso) =>
    formatISODate(addDays(parseISODate(iso), deltaDays));

  await saveEvent({
    ...event,
    startDate: shift(event.startDate),
    endDate: shift(event.endDate),
  });
  revalidatePath("/calendar");
  revalidatePath("/budget");
}

export async function deleteEventAction(
  semesterId,
  eventId,
) {
  await deleteEventRecord(semesterId, eventId);
  revalidatePath("/calendar");
  revalidatePath("/budget");
}

export async function saveContactsAction(formData) {
  const semesterId = String(formData.get("semesterId"));
  const ids = formData.getAll("contactId");
  const orgs = formData.getAll("contactOrg");
  const positions = formData.getAll("contactPosition");
  const statuses = formData.getAll("contactStatus");
  const phones = formData.getAll("contactPhone");
  const meetingDates = formData.getAll("contactMeetingDate");
  const notes = formData.getAll("contactNotes");

  const contacts = [];
  for (let i = 0; i < ids.length; i++) {
    const position = String(positions[i] ?? "").trim();
    if (!position) continue;
    contacts.push({
      id: String(ids[i] || crypto.randomUUID()),
      semesterId,
      org: String(orgs[i] ?? "").trim(),
      position,
      status: statuses[i],
      phone: String(phones[i] ?? "").trim(),
      meetingDate: String(meetingDates[i] ?? "").trim() || null,
      notes: String(notes[i] ?? "").trim(),
    });
  }

  await saveContacts(semesterId, contacts);
  revalidatePath("/contacts");
}

export async function saveDrinkPresetsAction(formData) {
  const presets = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("preset::")) continue;
    const [, categoryId, itemId] = key.split("::");
    const qty = Number.parseInt(String(value), 10);
    if (!qty) continue;
    presets[categoryId] = { ...presets[categoryId], [itemId]: qty };
  }

  await saveDrinkPresets(presets);
  revalidatePath("/drinks");
  revalidatePath("/calendar");
}

// Full replace of the drinkGroups catalog from the Drinks tab's editor form.
// Field naming: `group::${groupId}::label`, `item::${groupId}::${itemId}::name`,
// `item::${groupId}::${itemId}::price` — iterated in entry (DOM) order, which
// is what makes form order the stored order. Deleted groups/items are simply
// absent from the form. Deliberately never writes drinkPresets: reads tolerate
// orphaned item ids, and saveDrinkPresetsAction rebuilds the whole presets
// object from rendered inputs on its next save anyway, so an active scrub here
// would only add a read-modify-write race against the presets form that
// auto-saves from the same page.
export async function saveDrinkGroupsAction(formData) {
  const groups = [];
  const groupById = new Map();
  const seenNames = new Set();

  for (const [key, value] of formData.entries()) {
    const parts = key.split("::");
    if (parts[0] === "group" && parts[2] === "label") {
      const id = parts[1];
      // A group whose label was blanked out mid-edit still holds its items —
      // keep it under a placeholder rather than silently deleting them.
      const group = { id, label: String(value).trim() || "Untitled group", items: [] };
      groups.push(group);
      groupById.set(id, group);
    } else if (parts[0] === "item" && parts[3] === "name") {
      const group = groupById.get(parts[1]);
      const name = String(value).trim();
      const lowerName = name.toLowerCase();
      if (!group || !name || seenNames.has(lowerName)) continue;
      seenNames.add(lowerName);
      group.items.push({ id: parts[2], name, price: 0 });
    } else if (parts[0] === "item" && parts[3] === "price") {
      const item = groupById.get(parts[1])?.items.find((i) => i.id === parts[2]);
      const price = Number.parseFloat(String(value));
      if (!item || !Number.isFinite(price) || price < 0) continue;
      item.price = price;
    }
  }

  await saveDrinkGroups(groups);
  revalidatePath("/drinks");
  revalidatePath("/calendar");
}

export async function addDrinkItemAction(formData) {
  const name = String(formData.get("itemName") ?? "").trim();
  const groupId = String(formData.get("itemGroupId") ?? "");
  const price = Number.parseFloat(String(formData.get("itemPrice") ?? ""));
  const id = String(formData.get("itemId") ?? "") || crypto.randomUUID();

  if (!name || !Number.isFinite(price) || price < 0) {
    return;
  }

  const groups = await getDrinkGroups();
  if (!groups.some((g) => g.id === groupId)) return;
  const alreadyExists = groups.some((g) =>
    g.items.some((item) => item.name.toLowerCase() === name.toLowerCase()),
  );
  if (alreadyExists) return;

  await addDrinkItemToGroup(groupId, { id, name, price });
  revalidatePath("/calendar");
  revalidatePath("/drinks");
}

export async function saveEquipmentAction(formData) {
  const semesterId = String(formData.get("semesterId"));
  const id = String(formData.get("id") || crypto.randomUUID());
  const priorityRaw = String(formData.get("priority") ?? "").trim();
  const actualSpend = parseActualSpend(formData);

  const existing = (await getEquipmentItems()).find((i) => i.id === id);

  const item = {
    id,
    name: String(formData.get("name") ?? "").trim(),
    priority: priorityRaw ? Number.parseInt(priorityRaw, 10) : 0,
    expectedCostCents: parseDollarsToCents(formData.get("expectedCost")),
    expectedCostApproval: formData.get("expectedCostApproved") ? "approved" : "pending",
    actualSpend,
    link: String(formData.get("link") ?? "").trim(),
    notes: String(formData.get("notes") ?? ""),
    // Pin to whichever semester it was first purchased in; clearing all
    // actual spend puts it back on the open wishlist.
    purchasedSemesterId: actualSpend.length > 0 ? (existing?.purchasedSemesterId ?? semesterId) : null,
  };

  await saveEquipmentItem(item);
  revalidatePath("/budget");
}

export async function deleteEquipmentAction(id) {
  await deleteEquipmentItemRecord(id);
  revalidatePath("/budget");
}

// Semester ids show up in URLs (?semester=...) and Redis keys, so they're
// slugs of the label rather than UUIDs — easier to read when something needs
// debugging. Uniqueness is enforced against the existing list, since two
// semesters sharing an id would share their events.
function semesterIdFromLabel(label, existingIds) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "semester";
  if (!existingIds.has(base)) return base;
  let n = 2;
  while (existingIds.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

// Returns an error code instead of throwing: Next redacts thrown server-action
// messages in production, so a throw would show the exec board a generic
// "something went wrong" instead of what they actually got wrong. The caller
// redirects back with ?error=<code>, the same pattern loginAction uses.
function parseSemesterFields(formData) {
  const label = String(formData.get("label") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? "").trim();

  if (!label) return { error: "name" };
  if (!startDate || !endDate) return { error: "dates" };
  if (endDate < startDate) return { error: "order" };

  return {
    fields: {
      label,
      startDate,
      endDate,
      maxBudgetCents: parseDollarsToCents(formData.get("maxBudget")) ?? 0,
    },
  };
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function saveBrandingAction(formData) {
  const chapterName = String(formData.get("chapterName") ?? "").trim();
  if (!chapterName) redirect("/settings?error=chapterName");

  // Blank means "fall back to the default palette", so empty is allowed
  // through; anything present has to be a real hex color, since these values
  // land in a <style> tag.
  const colors = {};
  for (const [, key] of BRAND_COLOR_VARS) {
    const value = String(formData.get(`color-${key}`) ?? "").trim();
    if (value && !HEX_COLOR.test(value)) redirect("/settings?error=color");
    colors[key] = value;
  }

  const { chapterName: previousName } = await getBrandingSettings();
  await saveBrandingSettings({ chapterName, colors });
  await renameChapterInEventHosts(previousName, chapterName);

  revalidatePath("/", "layout");
  redirect("/settings");
}

/**
 * First-run setup: turns an empty deployment into a usable one. Refuses to run
 * a second time so a stray /setup visit can't overwrite a chapter's real work
 * with example data.
 */
export async function completeSetupAction(formData) {
  const existing = await getSemestersFresh();
  if (existing.length > 0) redirect("/calendar");

  const chapterName = String(formData.get("chapterName") ?? "").trim();
  if (!chapterName) redirect("/setup?error=chapterName");

  const { fields, error } = parseSemesterFields(formData);
  if (error) redirect(`/setup?error=${error}`);

  // Branding first, so example data (whose host defaults to the chapter) is
  // written under the name they just chose rather than the placeholder.
  // Colors are saved blank — setup has no color fields, so persisting
  // getBrandingSettings()'s env-resolved values here would freeze whatever
  // NEXT_PUBLIC_BRAND_* happened to be set at deploy time as if the chapter
  // had deliberately chosen it on the Settings page, permanently shadowing
  // any later change to that env var. Blank defers to the env default until
  // the chapter actually saves a color themselves.
  await saveBrandingSettings({ chapterName, colors: {} });

  const semester = { id: semesterIdFromLabel(fields.label, new Set()), ...fields };
  await saveSemester(semester);
  if (formData.get("exampleData")) {
    await seedExampleData(semester);
  }

  revalidatePath("/", "layout");
  redirect(`/calendar?semester=${semester.id}`);
}

export async function createSemesterAction(formData) {
  const { fields, error } = parseSemesterFields(formData);
  if (error) redirect(`/settings?error=${error}`);

  const semesters = await getSemesters();
  const id = semesterIdFromLabel(fields.label, new Set(semesters.map((s) => s.id)));

  await saveSemester({ id, ...fields });
  revalidatePath("/calendar");
  revalidatePath("/budget");
  revalidatePath("/settings");
  redirect(`/calendar?semester=${id}`);
}

export async function updateSemesterAction(formData) {
  const id = String(formData.get("semesterId"));
  const { fields, error } = parseSemesterFields(formData);
  if (error) redirect(`/settings?error=${error}`);

  const semester = await getSemester(id);
  if (!semester) redirect("/settings");

  await saveSemester({ ...semester, ...fields });
  revalidatePath("/calendar");
  revalidatePath("/budget");
  redirect("/settings");
}

export async function deleteSemesterAction(formData) {
  const id = String(formData.get("semesterId"));
  const semesters = await getSemesters();

  // Fast, friendly early exit for the common case — avoids an extra Redis
  // round trip when this is obviously the only semester. The real guard
  // (safe against two nearly-simultaneous deletes) lives in deleteSemester
  // itself, which re-checks against a fresh read rather than trusting this
  // cached one.
  if (semesters.length <= 1) redirect("/settings?error=last");

  let deleted = true;
  try {
    await deleteSemesterRecord(id);
  } catch {
    deleted = false;
  }
  if (!deleted) redirect("/settings?error=last");

  revalidatePath("/calendar");
  revalidatePath("/budget");
  redirect("/settings");
}

export async function updateMaxBudgetAction(formData) {
  const semesterId = String(formData.get("semesterId"));
  const maxBudgetCents = parseDollarsToCents(formData.get("maxBudget")) ?? 0;

  const semester = await getSemester(semesterId);
  if (!semester) return;

  await saveSemester({ ...semester, maxBudgetCents });
  revalidatePath("/budget");
  redirect(`/budget?semester=${semesterId}`);
}

export async function saveCategoriesAction(formData) {
  const ids = formData.getAll("categoryId").map(String);
  const labels = formData.getAll("categoryLabel").map(String);
  const colors = formData.getAll("categoryColor").map(String);
  const netsRevenueIds = new Set(formData.getAll("categoryNetsRevenue").map(String));
  const excludeIds = new Set(formData.getAll("categoryExcludeFromBudgetTotal").map(String));
  const otherOrgIds = new Set(formData.getAll("categoryIsOtherOrgCategory").map(String));

  const categories = [];
  for (let i = 0; i < ids.length; i++) {
    const label = labels[i]?.trim();
    if (!label) continue;
    const id = ids[i];
    categories.push({
      id,
      label,
      color: colors[i] || "#64748b",
      netsRevenue: netsRevenueIds.has(id),
      excludeFromBudgetTotal: excludeIds.has(id),
      isOtherOrgCategory: otherOrgIds.has(id),
    });
  }

  await saveCategories(categories);
  revalidatePath("/categories");
  revalidatePath("/calendar");
  revalidatePath("/budget");
  revalidatePath("/drinks");
}

export async function dismissOnboardingChecklistAction() {
  await dismissOnboardingChecklist();
  revalidatePath("/calendar");
}
