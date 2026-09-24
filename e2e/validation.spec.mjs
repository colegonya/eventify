import { test, expect } from "@playwright/test";
import { isoDaysFromToday } from "./support.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

test("a mangled calendar link opens the calendar instead of breaking", async ({ page }) => {
  // ?month=garbage used to render "undefined NaN"; ?week=nope crashed the page.
  const today = isoDaysFromToday(0);
  const thisMonth = `${MONTHS[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}`;

  await page.goto("/calendar?month=garbage");
  await expect(page.getByRole("heading", { level: 2, name: thisMonth })).toBeVisible();

  await page.goto("/calendar?view=week&week=nope");
  await expect(page.getByRole("heading", { level: 2 }).first()).not.toContainText(/undefined|NaN/);
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add event", exact: true })).toBeVisible();
});

test("the event editor shows the server's reason next to Save and stays open", async ({ page }) => {
  await page.goto(`/calendar?month=${isoDaysFromToday(0).slice(0, 7)}`);
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  const dialog = page.getByRole("dialog");

  // Spaces pass the browser's `required` check, so only the server catches this.
  await dialog.getByLabel("Name", { exact: true }).fill("   ");
  await dialog.getByLabel("Start date").fill(isoDaysFromToday(0));
  await dialog.getByRole("button", { name: "Save event" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("The event name can't be blank.");

  await dialog.getByLabel("Name", { exact: true }).fill("E2E backwards event");
  await dialog.getByLabel("End date").fill(isoDaysFromToday(-3));
  await dialog.getByRole("button", { name: "Save event" }).click();
  await expect(dialog.getByRole("alert")).toContainText(/end date can(no|')t be before/i);
  await expect(dialog).toBeVisible();
});

test("a blank max budget is refused and the cap stays as it was", async ({ page }) => {
  await page.goto("/budget");
  const budget = page.getByLabel("Max budget ($)");
  const before = await budget.inputValue();
  expect(before).not.toBe("");

  await budget.fill("");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  // Filtered by text: Next.js also keeps its own route announcer on the page
  // with role="alert".
  await expect(page.getByRole("alert").filter({ hasText: "The budget wasn't saved" })).toBeVisible();

  await page.goto("/budget");
  await expect(page.getByLabel("Max budget ($)")).toHaveValue(before);
});

test("clearing a category's name doesn't delete the category", async ({ page }) => {
  await page.goto("/categories");
  const names = page.getByLabel("Category name");
  const countBefore = await names.count();
  const first = names.first();
  const original = await first.inputValue();

  await first.fill("");
  await expect(page.getByRole("status")).toContainText("Not saved: A category needs a name");

  await page.reload();
  await expect(page.getByLabel("Category name")).toHaveCount(countBefore);
  await expect(page.getByLabel("Category name").first()).toHaveValue(original);
});
