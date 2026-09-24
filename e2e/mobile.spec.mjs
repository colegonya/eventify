import { test, expect } from "@playwright/test";

test("the calendar and budget load at phone size", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Calendar" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Budget" }).click();
  await expect(page).toHaveURL(/\/budget/);
  await expect(page.getByText(/Expected Spend/i).first()).toBeVisible();
});

test("on a phone, Today brings today's column into view", async ({ page }) => {
  await page.goto("/calendar?month=2027-03");
  await page.getByRole("link", { name: "Today" }).click();
  await expect(page.locator("[data-today]")).toBeInViewport();
});
