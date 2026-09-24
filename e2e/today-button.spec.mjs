import { test, expect } from "@playwright/test";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// The setup project records Los Angeles as the organization's time zone.
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const thisMonth = `${MONTHS[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}`;

test("Today jumps back to the current month from another month", async ({ page }) => {
  await page.goto("/calendar?month=2027-03");
  await expect(page.getByRole("heading", { level: 2, name: "March 2027" })).toBeVisible();

  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.getByRole("heading", { level: 2, name: thisMonth })).toBeVisible();
  await expect(page.locator("[data-today]")).toHaveCount(1);
});

test("Today stays in week view and lands on the week containing today", async ({ page }) => {
  await page.goto("/calendar?view=week&week=2027-03-10");
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page).toHaveURL(new RegExp(`view=week.*week=${today}|week=${today}.*view=week`));
  await expect(page.locator("[data-today]")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Previous week" })).toBeVisible();
});
