import { test, expect } from "@playwright/test";
import { E2E_PASSCODE } from "./env.mjs";
import { serverActionId, testRedis } from "./support.mjs";

// Not logged in: these run in a browser context with no cookies.
test.use({ storageState: { cookies: [], origins: [] } });

const redis = testRedis();

async function callActionWithoutCookie(request, path, exportedName) {
  return request.post(path, {
    headers: {
      "Next-Action": serverActionId(exportedName),
      "Content-Type": "text/plain;charset=UTF-8",
      Accept: "text/x-component",
    },
    data: "[]",
    maxRedirects: 0,
  });
}

test("server actions do nothing without a login cookie", async ({ request }) => {
  const passcodeBefore = await redis.get("authPasscodeHash");
  const dismissedBefore = await redis.get("onboardingChecklistDismissed");

  // /login is the one page the proxy lets through; this is the hole step 1
  // closed. Every other page redirects before the action can run.
  for (const path of ["/login", "/calendar"]) {
    for (const action of ["dismissOnboardingChecklistAction", "updatePasscodeAction"]) {
      // The status varies (a redirect, or "action not found" once an action
      // is no longer bundled on /login); what matters is that nothing changed.
      await callActionWithoutCookie(request, path, action);
    }
  }

  expect(await redis.get("authPasscodeHash")).toEqual(passcodeBefore);
  expect(await redis.get("onboardingChecklistDismissed")).toEqual(dismissedBefore);
});

test("the login redirect never leaves the site", async ({ page }) => {
  await page.goto(`/login?next=${encodeURIComponent("https://evil.example/phish")}`);
  await page.getByLabel("Passcode").fill(E2E_PASSCODE);
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page).toHaveURL(/127\.0\.0\.1:\d+\/calendar/);
});
