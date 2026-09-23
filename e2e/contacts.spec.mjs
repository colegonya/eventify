import { test, expect } from "@playwright/test";
import { uniqueName } from "./support.mjs";

test("a new contact autosaves and is still there after a reload", async ({ page }) => {
  const name = uniqueName("E2E Social Chair");

  await page.goto("/contacts");
  await page.getByRole("button", { name: "+ Add contact" }).click();
  await page.getByLabel("Contact name or role").last().fill(name);
  await page.getByLabel("Organization").last().fill("E2E Partner Org");
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  const names = await page.getByLabel("Contact name or role").evaluateAll((inputs) =>
    inputs.map((input) => input.value),
  );
  expect(names).toContain(name);
});
