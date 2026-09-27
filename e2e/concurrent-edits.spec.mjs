import { test, expect } from "@playwright/test";
import { AUTH_STATE_PATH } from "./env.mjs";
import { uniqueName } from "./support.mjs";

// Two officers with the same page open, each editing a different row. Each
// save used to send every row on the page, so the second one wrote back its
// stale copy of the row the first had just changed.

async function officer(browser, path) {
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  const page = await context.newPage();
  await page.goto(path);
  return page;
}

// The block holding one contact, found by the name it loaded with.
const contactRow = (page, name) =>
  page.locator(
    `xpath=//input[@name="contactPosition" and @value="${name}"]/ancestor::div[input[@name="contactId"]][1]`,
  );

test("two officers editing different contacts both keep their changes", async ({ browser, page }) => {
  const first = uniqueName("E2E President");
  const second = uniqueName("E2E Treasurer");

  await page.goto("/contacts");
  for (const name of [first, second]) {
    await page.getByRole("button", { name: "+ Add contact" }).click();
    // No org, so the row stays where it is (see the regrouping test in
    // contacts.spec.mjs).
    await page.getByLabel("Contact name or role").last().fill(name);
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    // Let the flash fade, so the next row's "Saved" is its own.
    await expect(page.getByText("Saved", { exact: true })).toBeHidden();
  }

  const alex = await officer(browser, "/contacts");
  const sam = await officer(browser, "/contacts");

  await contactRow(alex, first).getByLabel("Phone number").fill("5550100100");
  await expect(alex.getByText("Saved", { exact: true })).toBeVisible();

  // Sam's page still shows the phone from before Alex's save.
  await contactRow(sam, second).getByLabel("Notes").fill("Call about the mixer");
  await expect(sam.getByText("Saved", { exact: true })).toBeVisible();

  await page.reload();
  await expect(contactRow(page, first).getByLabel("Phone number")).toHaveValue("(555) 010-0100");
  await expect(contactRow(page, second).getByLabel("Notes")).toHaveValue("Call about the mixer");
});

test("two officers editing different drink items both keep their changes", async ({ browser, page }) => {
  const alex = await officer(browser, "/drinks");
  const sam = await officer(browser, "/drinks");

  const names = await alex.getByLabel("Item name").evaluateAll((inputs) => inputs.map((i) => i.value));
  const [firstItem, secondItem] = names;
  const renamed = uniqueName("E2E Lager").slice(0, 60);

  await alex.getByLabel(`Price per unit for ${firstItem}`).fill("99.5");
  await expect(alex.getByText("Saved", { exact: true })).toBeVisible();

  await sam.locator(`input[aria-label="Item name"][value="${secondItem}"]`).fill(renamed);
  await expect(sam.getByText("Saved", { exact: true })).toBeVisible();

  await page.goto("/drinks");
  await expect(page.getByLabel(`Price per unit for ${firstItem}`)).toHaveValue("99.5");
  await expect(page.locator(`input[aria-label="Item name"][value="${renamed}"]`)).toBeVisible();
});
