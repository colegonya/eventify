import { test, expect } from "@playwright/test";

const todayIn = (timeZone) =>
  new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

test("setup records the browser's time zone, and the calendar marks today in it", async ({ page }) => {
  // The setup project runs as a browser in Los Angeles.
  await page.goto("/settings");
  await expect(page.getByLabel("Time zone")).toHaveValue("America/Los_Angeles");

  // Servers run on UTC, which is already tomorrow from 5pm Pacific. The
  // marker has to follow Pacific time whenever this runs.
  const today = todayIn("America/Los_Angeles");
  await page.goto(`/calendar?month=${today.slice(0, 7)}`);
  await expect(page.locator("[data-today]")).toHaveCount(1);
  await expect(page.locator("[data-today]")).toContainText(String(Number(today.slice(8, 10))));
});

test("changing the time zone in Settings is saved", async ({ page }) => {
  await page.goto("/settings");
  const zone = page.getByLabel("Time zone");
  await zone.selectOption("America/New_York");
  await page.getByRole("button", { name: "Save organization details" }).click();
  await page.waitForURL(/\/settings/);
  await page.reload();
  await expect(page.getByLabel("Time zone")).toHaveValue("America/New_York");

  // Put it back for the rest of the suite.
  await page.getByLabel("Time zone").selectOption("America/Los_Angeles");
  await page.getByRole("button", { name: "Save organization details" }).click();
  await page.waitForURL(/\/settings/);
  await page.reload();
  await expect(page.getByLabel("Time zone")).toHaveValue("America/Los_Angeles");
});
