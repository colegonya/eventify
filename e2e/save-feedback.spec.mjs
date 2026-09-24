import { test, expect } from "@playwright/test";

// Saves take well under a second locally, so hold each form POST briefly to
// make the in-flight state observable.
async function slowFormPosts(page, pathGlob) {
  await page.route(pathGlob, async (route) => {
    if (route.request().method() === "POST") await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
}

const notice = (page, text) => page.getByRole("status").filter({ hasText: text });

test("saving organization details shows Saving…, then a confirmation beside the button", async ({ page }) => {
  await slowFormPosts(page, "**/settings**");
  await page.goto("/settings");

  const save = page.getByRole("button", { name: "Save organization details" });
  await save.click();
  await expect(page.getByRole("button", { name: "Saving…" })).toBeDisabled();

  await expect(notice(page, "Saved organization details")).toBeVisible();
  await expect(notice(page, "Saved organization details")).toBeInViewport();
  // Gone from the address bar, so a refresh doesn't claim a new save.
  await expect(page).not.toHaveURL(/saved=/);
  await page.reload();
  await expect(notice(page, "Saved organization details")).toHaveCount(0);
});

test("saving twice in a row confirms both times", async ({ page }) => {
  await page.goto("/settings");
  const save = page.getByRole("button", { name: "Save organization details" });

  await save.click();
  await expect(notice(page, "Saved organization details")).toBeVisible();
  const first = await notice(page, "Saved organization details").elementHandle();

  await save.click();
  // A new notice element for the second save, not the first one lingering.
  await expect
    .poll(async () => (await notice(page, "Saved organization details").elementHandle()) !== first)
    .toBe(true);
  await expect(notice(page, "Saved organization details")).toBeVisible();
});

test("a semester row's Save shows its own progress and confirmation, and Delete stays idle", async ({ page }) => {
  await slowFormPosts(page, "**/settings**");
  await page.goto("/settings");

  const row = page.locator("form").filter({ has: page.locator('input[name="semesterId"]') }).first();
  const label = await row.locator('input[name="label"]').inputValue();
  await row.getByRole("button", { name: "Save", exact: true }).click();

  await expect(row.getByRole("button", { name: "Saving…" })).toBeDisabled();
  // The shared form disables Delete too, but only Save says it's working.
  await expect(row.getByRole("button", { name: "Delete" })).toBeDisabled();

  await expect(notice(page, `Saved ${label}`)).toBeVisible();
  await expect(notice(page, `Saved ${label}`)).toBeInViewport();
});

test("the Budget page's max budget Save shows progress and a confirmation", async ({ page }) => {
  await slowFormPosts(page, "**/budget**");
  await page.goto("/budget");

  const form = page.locator("form").filter({ has: page.getByLabel("Max budget ($)") });
  await form.getByRole("button", { name: "Save", exact: true }).click();
  await expect(form.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await expect(form.getByRole("status")).toHaveText(/Saved/);
  // The semester stays in the URL; only the notice's params are removed.
  await expect(page).not.toHaveURL(/saved=/);
  await expect(page).toHaveURL(/semester=/);
});
