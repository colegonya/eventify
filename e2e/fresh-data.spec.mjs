import { test, expect } from "@playwright/test";
import { testRedis, uniqueName } from "./support.mjs";

// On Vercel, a save can land on one server instance and the next page load on
// another. These tests change data straight in Redis, the way another
// instance would, and expect the very next page load to show it.

test("a chapter name saved elsewhere shows on the next page load", async ({ page }) => {
  const redis = testRedis();
  const original = await redis.get("branding");
  const renamed = uniqueName("E2E Chapter");

  try {
    await page.goto("/settings");
    const nameField = page.locator('input[name="chapterName"]');
    await expect(nameField).toHaveValue(original.chapterName);

    await redis.set("branding", { ...original, chapterName: renamed });
    await page.reload();

    await expect(nameField).toHaveValue(renamed);
  } finally {
    await redis.set("branding", original);
  }
});

test("a category added elsewhere shows on the next page load", async ({ page }) => {
  const redis = testRedis();
  const original = await redis.get("categories");
  const label = uniqueName("E2E Category").slice(0, 60);

  try {
    await page.goto("/categories");
    await expect(page.getByLabel("Category name").first()).toBeVisible();

    await redis.set("categories", [
      ...original,
      { id: "e2e-fresh", label, color: "#123456", netsRevenue: false, excludeFromBudgetTotal: false, isOtherOrgCategory: false },
    ]);
    await page.reload();

    const labels = await page.getByLabel("Category name").evaluateAll((inputs) => inputs.map((i) => i.value));
    expect(labels).toContain(label);
  } finally {
    await redis.set("categories", original);
  }
});
