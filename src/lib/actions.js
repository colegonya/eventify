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
  getContacts,
  saveContacts,
  getMarkers,
  saveMarkers,
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
  getEditorSupportingData,
} from "@/lib/data";
import { parseISODate, formatISODate, addDays, daysBetween, isValidTimeZone } from "@/lib/dates";
import {
  AUTH_COOKIE_NAME,
  AUTH_COOKIE_OPTIONS,
  createSessionToken,
  setPasscode,
  MIN_PASSCODE_LENGTH,
} from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { semesterIdFromLabel, parseSemesterFields, parseMaxBudget } from "@/lib/semesters";
import { fail, isRealIsoDate, LIMITS, ok } from "@/lib/validation";
import { parseEventForm } from "@/lib/forms/event";
import { parseEquipmentForm } from "@/lib/forms/equipment";
import { parseCategoriesForm, parseContactsForm, parseMarkersForm } from "@/lib/forms/lists";
import { parseDrinkGroupsForm, parseDrinkPresetsForm, parseNewDrinkItem } from "@/lib/forms/drinks";
import { BRAND_COLOR_VARS, DEFAULT_TIME_ZONE } from "@/lib/config";
import { isHexColor } from "@/lib/color";
import { computeCategorySpendStats, computeEquipmentContribution } from "@/lib/budget";
import { equipmentItemsForSemester } from "@/lib/equipment";

// Where a server-rendered form goes after a successful save. `saved` tells the
// page which "✓ Saved" notice to show beside which button (see SavedNotice),
// and `at` makes each save a distinct URL so a second save shows it again.
function savedUrl(path, params) {
  const query = new URLSearchParams({ ...params, at: String(Date.now()) });
  return `${path}?${query}`;
}

/**
 * Rotates the shared passcode. Every other logged-in browser is signed out,
 * since their session was issued under the old passcode — which is exactly
 * what you want after exec turnover or a leak. The officer doing the rotating
 * gets a fresh session so they aren't kicked out of the page they're on.
 */
export async function updatePasscodeAction(formData) {
  await requireSession();
  const passcode = String(formData.get("passcode") ?? "");
  const confirmation = String(formData.get("passcodeConfirm") ?? "");

  if (passcode.length < MIN_PASSCODE_LENGTH) redirect("/settings?error=passcodeShort");
  if (passcode !== confirmation) redirect("/settings?error=passcodeMismatch");

  await setPasscode(passcode);
  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, await createSessionToken(), AUTH_COOKIE_OPTIONS);

  redirect(savedUrl("/settings", { saved: "passcode" }));
}

/**
 * Signs this browser out. Other browsers stay signed in; changing the
 * passcode in Settings is what signs everyone out.
 */
export async function signOutAction() {
  await requireSession();
  (await cookies()).delete(AUTH_COOKIE_NAME);
  redirect("/login");
}

// Called directly from EditorProvider (a client component) when the event
// editor dialog opens, the same way DayCell calls moveEventAction directly —
// not tied to a <form>. Computes the editor's supporting figures server-side
// (categorySpendStats, equipmentExpectedCents) rather than shipping every
// semester's raw event history to the client to recompute them there.
export async function getEditorSupportingDataAction(semesterId) {
  await requireSession();
  // The semester list comes from the server, not the caller, so this can only
  // ever read real semesters' events.
  const semesterIds = (await getSemesters()).map((s) => s.id);
  const { drinkPresets, drinkItemGroups, equipmentItems, allEvents } = await getEditorSupportingData(
    semesterId,
    semesterIds,
  );

  const categorySpendStats = Object.fromEntries(computeCategorySpendStats(allEvents));
  const equipmentExpectedCents = equipmentItemsForSemester(equipmentItems, semesterId).reduce(
    (sum, item) => sum + computeEquipmentContribution(item).expectedContributionCents,
    0,
  );

  return { drinkPresets, drinkItemGroups, categorySpendStats, equipmentExpectedCents };
}

/**
 * Returns { ok, error, fieldErrors } rather than throwing, so the editor can
 * say what to fix. See lib/validation.js.
 */
export async function saveEventAction(formData) {
  await requireSession();
  const semesterId = String(formData.get("semesterId") ?? "");
  const [semester, categories, { chapterName }] = await Promise.all([
    getSemester(semesterId),
    getCategories(),
    getBrandingSettings(),
  ]);
  if (!semester) return fail("That semester no longer exists. Reload the page.");

  const parsed = parseEventForm(formData, new Set(categories.map((c) => c.id)));
  if (!parsed.ok) return parsed;
  const fields = parsed.data;
  const matchedCategory = categories.find((c) => c.id === fields.category);

  // The host field is read-only in the UI for every category except "other
  // org" ones: for the chapter's own events, host is always the chapter
  // itself, not something an officer picks. A readOnly input still submits its
  // current value, so a form left open across a chapter rename in another tab
  // could submit a stale name. Resolve it fresh instead of trusting the
  // client. Validation has already refused a category that doesn't exist, so
  // which kind this is is never a guess.
  const host = matchedCategory.isOtherOrgCategory ? fields.host || chapterName : chapterName;

  await saveEvent({
    id: String(formData.get("id") || crypto.randomUUID()),
    semesterId,
    ...fields,
    host,
  });
  revalidatePath("/calendar");
  revalidatePath("/budget");
  return ok();
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
  await requireSession();
  if (!isRealIsoDate(fromDate) || !isRealIsoDate(toDate)) return fail("That isn't a real date.");
  if (fromDate === toDate) return ok();

  const events = await getEvents(semesterId);
  const event = events.find((e) => e.id === eventId);
  if (!event) return fail("That event no longer exists. Reload the page.");

  const deltaDays = daysBetween(fromDate, toDate);
  const shift = (iso) => formatISODate(addDays(parseISODate(iso), deltaDays));

  await saveEvent({
    ...event,
    startDate: shift(event.startDate),
    endDate: shift(event.endDate),
  });
  revalidatePath("/calendar");
  revalidatePath("/budget");
  return ok();
}

export async function deleteEventAction(
  semesterId,
  eventId,
) {
  await requireSession();
  await deleteEventRecord(String(semesterId), String(eventId));
  revalidatePath("/calendar");
  revalidatePath("/budget");
  return ok();
}

export async function saveContactsAction(formData) {
  await requireSession();
  const semesterId = String(formData.get("semesterId") ?? "");
  if (!(await getSemester(semesterId))) return fail("That semester no longer exists. Reload the page.");

  const existingIds = new Set((await getContacts(semesterId)).map((c) => c.id));
  const parsed = parseContactsForm(formData, semesterId, existingIds);
  if (!parsed.ok) return parsed;

  await saveContacts(semesterId, parsed.data);
  revalidatePath("/contacts");
  return ok();
}

export async function saveDrinkPresetsAction(formData) {
  await requireSession();
  const parsed = parseDrinkPresetsForm(formData);
  if (!parsed.ok) return parsed;

  await saveDrinkPresets(parsed.data);
  revalidatePath("/drinks");
  revalidatePath("/calendar");
  return ok();
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
  await requireSession();
  const existingItemIds = new Set((await getDrinkGroups()).flatMap((g) => g.items.map((item) => item.id)));
  const parsed = parseDrinkGroupsForm(formData, existingItemIds);
  if (!parsed.ok) return parsed;

  await saveDrinkGroups(parsed.data);
  revalidatePath("/drinks");
  revalidatePath("/calendar");
  return ok();
}

export async function addDrinkItemAction(formData) {
  await requireSession();
  const parsed = parseNewDrinkItem(formData, await getDrinkGroups());
  if (!parsed.ok) return parsed;

  const { groupId, ...item } = parsed.data;
  await addDrinkItemToGroup(groupId, item);
  revalidatePath("/calendar");
  revalidatePath("/drinks");
  return ok(item);
}

export async function saveEquipmentAction(formData) {
  await requireSession();
  const semesterId = String(formData.get("semesterId") ?? "");
  if (!(await getSemester(semesterId))) return fail("That semester no longer exists. Reload the page.");

  const parsed = parseEquipmentForm(formData);
  if (!parsed.ok) return parsed;

  const id = String(formData.get("id") || crypto.randomUUID());
  const existing = (await getEquipmentItems()).find((i) => i.id === id);
  const item = {
    id,
    ...parsed.data,
    // Pin to whichever semester it was first purchased in; clearing all
    // actual spend puts it back on the open wishlist.
    purchasedSemesterId:
      parsed.data.actualSpend.length > 0 ? (existing?.purchasedSemesterId ?? semesterId) : null,
  };

  await saveEquipmentItem(item);
  revalidatePath("/budget");
  return ok();
}

/**
 * Replaces the whole marker list for a semester, the same way the contacts and
 * categories tables save: the editor owns every row on screen, so a removed
 * row is simply one that isn't in the submission.
 */
export async function saveMarkersAction(formData) {
  await requireSession();
  const semesterId = String(formData.get("semesterId") ?? "");
  if (!(await getSemester(semesterId))) return fail("That semester no longer exists. Reload the page.");

  const existingIds = new Set((await getMarkers(semesterId)).map((m) => m.id));
  const parsed = parseMarkersForm(formData, semesterId, existingIds);
  if (!parsed.ok) return parsed;

  await saveMarkers(semesterId, parsed.data);
  revalidatePath("/calendar");
  return ok();
}

export async function deleteEquipmentAction(id) {
  await requireSession();
  await deleteEquipmentItemRecord(String(id));
  revalidatePath("/budget");
  return ok();
}

export async function saveBrandingAction(formData) {
  await requireSession();
  const chapterName = String(formData.get("chapterName") ?? "").trim();
  if (!chapterName) redirect("/settings?error=chapterName");
  if (chapterName.length > LIMITS.shortName) redirect("/settings?error=length");

  // Blank means "fall back to the default palette", so empty is allowed
  // through; anything present has to be a real hex color, since these values
  // land in a <style> tag.
  const colors = {};
  for (const [, key] of BRAND_COLOR_VARS) {
    const value = String(formData.get(`color-${key}`) ?? "").trim();
    if (value && !isHexColor(value)) redirect("/settings?error=color");
    colors[key] = value;
  }

  // Blank is meaningful for all three: it means "use the default", which is
  // how an org clears a word it set by mistake.
  const orgNoun = String(formData.get("orgNoun") ?? "").trim();
  const periodNoun = String(formData.get("periodNoun") ?? "").trim();
  const title = String(formData.get("appTitle") ?? "").trim();
  if (orgNoun.length > 30 || periodNoun.length > 30 || title.length > LIMITS.name) {
    redirect("/settings?error=length");
  }

  const timeZone = String(formData.get("timeZone") ?? "").trim();
  if (!isValidTimeZone(timeZone)) redirect("/settings?error=timeZone");

  const { chapterName: previousName } = await getBrandingSettings();
  await saveBrandingSettings({ chapterName, colors, orgNoun, periodNoun, appTitle: title, timeZone });
  await renameChapterInEventHosts(previousName, chapterName);

  revalidatePath("/", "layout");
  redirect(savedUrl("/settings", { saved: "organization" }));
}

/**
 * First-run setup: turns an empty deployment into a usable one. Refuses to run
 * a second time so a stray /setup visit can't overwrite a chapter's real work
 * with example data.
 */
export async function completeSetupAction(formData) {
  await requireSession();
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
  // The officer's browser supplies this; anything unusable falls back to the
  // default and can be changed in Settings.
  const browserTimeZone = String(formData.get("timeZone") ?? "").trim();
  const timeZone = isValidTimeZone(browserTimeZone) ? browserTimeZone : DEFAULT_TIME_ZONE;
  await saveBrandingSettings({ chapterName, colors: {}, timeZone });

  const semester = { id: semesterIdFromLabel(fields.label, new Set()), ...fields };
  await saveSemester(semester);
  if (formData.get("exampleData")) {
    await seedExampleData(semester);
  }

  revalidatePath("/", "layout");
  redirect(`/calendar?semester=${semester.id}`);
}

export async function createSemesterAction(formData) {
  await requireSession();
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
  await requireSession();
  const id = String(formData.get("semesterId"));
  const { fields, error } = parseSemesterFields(formData);
  if (error) redirect(`/settings?error=${error}`);

  const semester = await getSemester(id);
  if (!semester) redirect("/settings");

  await saveSemester({ ...semester, ...fields });
  revalidatePath("/calendar");
  revalidatePath("/budget");
  redirect(savedUrl("/settings", { saved: "semester", id }));
}

export async function deleteSemesterAction(formData) {
  await requireSession();
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
  redirect(savedUrl("/settings", { saved: "semesterDeleted" }));
}

export async function updateMaxBudgetAction(formData) {
  await requireSession();
  const semesterId = String(formData.get("semesterId") ?? "");
  const semester = await getSemester(semesterId);
  if (!semester) redirect("/budget");

  const maxBudgetCents = parseMaxBudget(formData.get("maxBudget"));
  if (maxBudgetCents === null) redirect(`/budget?semester=${encodeURIComponent(semesterId)}&error=budget`);

  await saveSemester({ ...semester, maxBudgetCents });
  revalidatePath("/budget");
  redirect(savedUrl("/budget", { semester: semesterId, saved: "budget" }));
}

export async function saveCategoriesAction(formData) {
  await requireSession();
  const existingIds = new Set((await getCategories()).map((c) => c.id));
  const parsed = parseCategoriesForm(formData, existingIds);
  if (!parsed.ok) return parsed;

  await saveCategories(parsed.data);
  revalidatePath("/categories");
  revalidatePath("/calendar");
  revalidatePath("/budget");
  revalidatePath("/drinks");
  return ok();
}

export async function dismissOnboardingChecklistAction() {
  await requireSession();
  await dismissOnboardingChecklist();
  revalidatePath("/calendar");
}
