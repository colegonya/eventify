"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  saveEvent,
  deleteEvent as deleteEventRecord,
  getEvents,
  getSemester,
  saveSemester,
  saveContacts,
  saveDrinkPresets,
  getDrinkItemGroups,
  addCustomDrinkItem,
  saveCustomDrinkItems,
  getEquipmentItems,
  saveEquipmentItem,
  deleteEquipmentItem as deleteEquipmentItemRecord,
  saveCategories,
} from "@/lib/data";
import { parseISODate, formatISODate, addDays } from "@/lib/dates";
import { AUTH_COOKIE_NAME, expectedAuthCookieValue, isValidPasscode } from "@/lib/auth";
import { CHAPTER_NAME } from "@/lib/config";
import { GROUP_LABELS } from "@/lib/drinkItems";

export async function loginAction(formData) {
  const passcode = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/calendar");

  if (!isValidPasscode(passcode)) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=1`);
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, expectedAuthCookieValue(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  redirect(next);
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

  const event = {
    id,
    semesterId,
    name: String(formData.get("name") ?? "").trim(),
    category: String(formData.get("category") ?? ""),
    host: String(formData.get("host") ?? "").trim() || CHAPTER_NAME,
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
    const [, categoryId, itemName] = key.split("::");
    const qty = Number.parseInt(String(value), 10);
    if (!qty) continue;
    presets[categoryId] = { ...presets[categoryId], [itemName]: qty };
  }

  await saveDrinkPresets(presets);
  revalidatePath("/autofill");
  revalidatePath("/calendar");
}

export async function addDrinkItemAction(formData) {
  const name = String(formData.get("itemName") ?? "").trim();
  const group = String(formData.get("itemGroup") ?? "");
  const price = Number.parseFloat(String(formData.get("itemPrice") ?? ""));

  if (!name || !GROUP_LABELS.includes(group) || !Number.isFinite(price) || price < 0) {
    return;
  }

  const groups = await getDrinkItemGroups();
  const alreadyExists = groups.some((g) =>
    g.items.some((item) => item.name.toLowerCase() === name.toLowerCase()),
  );
  if (alreadyExists) return;

  await addCustomDrinkItem({ id: crypto.randomUUID(), name, price, group });
  revalidatePath("/calendar");
  revalidatePath("/autofill");
}

export async function saveCustomDrinkItemsAction(formData) {
  const ids = formData.getAll("customItemId");
  const names = formData.getAll("customItemName");
  const prices = formData.getAll("customItemPrice");
  const itemGroups = formData.getAll("customItemGroup");

  const items = [];
  const seenNames = new Set();
  for (let i = 0; i < ids.length; i++) {
    const name = String(names[i] ?? "").trim();
    if (!name) continue;
    const group = String(itemGroups[i] ?? "");
    if (!GROUP_LABELS.includes(group)) continue;
    const price = Number.parseFloat(String(prices[i] ?? ""));
    if (!Number.isFinite(price) || price < 0) continue;
    const lowerName = name.toLowerCase();
    if (seenNames.has(lowerName)) continue;
    seenNames.add(lowerName);
    items.push({ id: String(ids[i]), name, price, group });
  }

  await saveCustomDrinkItems(items);
  revalidatePath("/calendar");
  revalidatePath("/autofill");
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
  revalidatePath("/autofill");
}
