import { test, expect } from "@playwright/test";
import { isoDaysFromToday, uniqueName } from "./support.mjs";

// A date inside this month, so the event lands on the grid the test opens.
const eventDate = isoDaysFromToday(0);
const month = eventDate.slice(0, 7);

test("add, edit, and delete an event", async ({ page }) => {
  const name = uniqueName("E2E Mixer");
  const renamed = `${name} (moved)`;

  await page.goto(`/calendar?month=${month}`);
  await page.getByRole("button", { name: "Add event", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Add Event" })).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Start date").fill(eventDate);
  await dialog.getByLabel("Expected spend ($)").fill("123.45");
  await dialog.getByRole("button", { name: "Save event" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByRole("button", { name })).toBeVisible();

  // The Budget page reads the same event.
  await page.goto("/budget");
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toContainText("$123.45");

  // Edit survives a reload.
  await page.goto(`/calendar?month=${month}`);
  await page.getByRole("button", { name }).click();
  await expect(dialog.getByRole("heading", { name: "Edit Event" })).toBeVisible();
  await dialog.getByLabel("Name", { exact: true }).fill(renamed);
  await dialog.getByRole("button", { name: "Save event" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: renamed })).toBeVisible();

  // Delete survives a reload.
  await page.getByRole("button", { name: renamed }).click();
  await dialog.getByRole("button", { name: "Delete event" }).click();
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  await expect(page.getByRole("button", { name: renamed })).toHaveCount(0);
});
