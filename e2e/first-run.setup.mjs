import { test as setup, expect } from "@playwright/test";
import { AUTH_STATE_PATH, E2E_PASSCODE } from "./env.mjs";
import { isoDaysFromToday } from "./support.mjs";

// Runs once, before every other project: the path a brand-new deployment
// takes. Saves the logged-in session for the tests that follow.
setup("a new officer logs in and sets up the first semester", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Passcode").fill("not-the-passcode");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText("Incorrect passcode. Try again.")).toBeVisible();

  await page.getByLabel("Passcode").fill(E2E_PASSCODE);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/\/setup/);

  await page.getByLabel("Organization name").fill("E2E Chapter");
  await page.getByLabel("Semester name").fill("E2E Semester");
  // Spans today, so the calendar opens on a month inside the semester.
  await page.getByLabel("First day").fill(isoDaysFromToday(-60));
  await page.getByLabel("Last day").fill(isoDaysFromToday(120));
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create semester" }).click();

  await expect(page).toHaveURL(/\/calendar/);
  await expect(page.getByRole("heading", { name: "E2E Chapter Social Calendar", level: 1 })).toBeAttached();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Budget" })).toBeVisible();

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
