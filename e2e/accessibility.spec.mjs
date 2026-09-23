import { test } from "@playwright/test";
import { recordAccessibility } from "./support.mjs";

// Report-only: records axe results for every page in the test report and
// never fails. See recordAccessibility for why.
for (const path of ["/calendar", "/budget", "/contacts", "/categories", "/drinks", "/settings"]) {
  test(`accessibility scan: ${path}`, async ({ page }, testInfo) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await recordAccessibility(page, testInfo, path.slice(1));
  });
}
