import { test, expect } from "@playwright/test";

test("the calendar and budget load at phone size", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
  await expect(page.getByRole("navigation").getByRole("link", { name: "Calendar" })).toBeVisible();

  await page.getByRole("navigation").getByRole("link", { name: "Budget" }).click();
  await expect(page).toHaveURL(/\/budget/);
  await expect(page.getByText(/Expected Spend/i).first()).toBeVisible();
});
