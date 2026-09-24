import { test, expect } from "@playwright/test";
import { isoDaysFromToday, uniqueName } from "./support.mjs";

// Server actions are POSTs carrying a Next-Action header. These helpers cut
// or hold only those, so page loads keep working.
const isAction = (request) => request.method() === "POST" && Boolean(request.headers()["next-action"]);

/** Fails every server action while `connection.down` is true. */
async function flakyConnection(page) {
  const connection = { down: true };
  await page.route("**/*", async (route) => {
    if (connection.down && isAction(route.request())) return route.abort("internetdisconnected");
    return route.fallback();
  });
  return connection;
}

const month = isoDaysFromToday(0).slice(0, 7);
const dayCell = (page, iso) => page.getByRole("button", { name: `Add event on ${iso}` }).locator("xpath=../..");

async function addEvent(page, name, date) {
  await page.goto(`/calendar?month=${month}`);
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Start date").fill(date);
  await dialog.getByRole("button", { name: "Save event" }).click();
  await expect(dialog).toBeHidden();
}

test("an autosave that can't reach the server retries, then offers Retry, and nothing is lost", async ({ page }) => {
  // Three automatic retries take 1 + 3 + 9 seconds before Retry shows.
  test.setTimeout(60_000);
  const name = uniqueName("E2E Offline Contact");
  await page.goto("/contacts");
  const connection = await flakyConnection(page);

  await page.getByRole("button", { name: "+ Add contact" }).click();
  await page.getByLabel("Contact name or role").last().fill(name);

  await expect(page.getByRole("status").filter({ hasText: "Connection lost. Retrying…" })).toBeVisible();
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("status").filter({ hasText: "Not saved" })).toBeVisible();
  // The edit is still on screen, waiting.
  await expect(page.getByLabel("Contact name or role").last()).toHaveValue(name);

  connection.down = false;
  await retry.click();
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(retry).toBeHidden();

  await page.reload();
  const names = await page.getByLabel("Contact name or role").evaluateAll((inputs) => inputs.map((i) => i.value));
  expect(names).toContain(name);
});

test("an autosave picks back up on its own when the connection returns", async ({ page }) => {
  const name = uniqueName("E2E Blip Contact");
  await page.goto("/contacts");
  const connection = await flakyConnection(page);

  await page.getByRole("button", { name: "+ Add contact" }).click();
  await page.getByLabel("Contact name or role").last().fill(name);
  await expect(page.getByRole("status").filter({ hasText: "Connection lost. Retrying…" })).toBeVisible();

  connection.down = false;
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 10_000 });
});

test("an edit made just before leaving the page is still saved", async ({ page }) => {
  const name = uniqueName("E2E Quick Exit");
  await page.goto("/contacts");
  await page.getByRole("button", { name: "+ Add contact" }).click();
  await page.getByLabel("Contact name or role").last().fill(name);
  // Well inside the 0.8 second typing delay.
  await page.getByRole("link", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/\/calendar/);

  await expect(async () => {
    await page.goto("/contacts");
    const names = await page.getByLabel("Contact name or role").evaluateAll((inputs) => inputs.map((i) => i.value));
    expect(names).toContain(name);
  }).toPass({ timeout: 10_000 });
});

test("closing the event editor asks first only when something changed", async ({ page }) => {
  await page.goto(`/calendar?month=${month}`);
  const dialog = page.getByRole("dialog");
  const discardPrompt = dialog.getByText("Discard your changes?");

  // Untouched: Escape closes right away.
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await expect(dialog.getByLabel("Name", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Edited: Escape, Close, and a click outside all ask instead.
  await page.getByRole("button", { name: "Add event", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill("Half-typed name");
  await page.keyboard.press("Escape");
  await expect(discardPrompt).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();

  await dialog.getByRole("button", { name: "Keep editing" }).click();
  await expect(discardPrompt).toBeHidden();
  await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue("Half-typed name");

  await page.mouse.click(5, 5);
  await expect(discardPrompt).toBeVisible();
  await dialog.getByRole("button", { name: "Keep editing" }).click();

  await dialog.getByRole("button", { name: "Close ✕" }).click();
  await expect(discardPrompt).toBeVisible();
  await dialog.getByRole("button", { name: "Discard" }).click();
  await expect(dialog).toBeHidden();
});

test("a dragged event moves at once, and snaps back with a message if the move fails", async ({ page }) => {
  const name = uniqueName("E2E Drag");
  const from = `${month}-10`;
  const to = `${month}-12`;
  await addEvent(page, name, from);
  const chip = (iso) => dayCell(page, iso).getByRole("button", { name });

  // Hold the move's save for 3 seconds: the chip must be on its new day
  // well before the server answers.
  await page.route("**/*", async (route) => {
    if (isAction(route.request())) await new Promise((resolve) => setTimeout(resolve, 3000));
    return route.fallback();
  });
  const moveSaved = page.waitForResponse((response) => isAction(response.request()));
  await chip(from).dragTo(dayCell(page, to));
  await expect(chip(to)).toBeVisible({ timeout: 1000 });
  await expect(chip(from)).toHaveCount(0);
  await moveSaved;
  await page.reload();
  await expect(chip(to)).toBeVisible();

  // A failed move puts it back and says so.
  await page.unrouteAll({ behavior: "wait" });
  await flakyConnection(page);
  await chip(to).dragTo(dayCell(page, from));
  await expect(page.getByText("Couldn't move the event. Check your connection and try again.")).toBeVisible();
  await expect(chip(to)).toBeVisible();
  await expect(chip(from)).toHaveCount(0);
});

test("deleting an event confirms with a toast", async ({ page }) => {
  const name = uniqueName("E2E Toast");
  await addEvent(page, name, `${month}-14`);
  await page.getByRole("button", { name }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Delete event" }).click();
  await dialog.getByRole("button", { name: "Confirm delete" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(`Deleted "${name}"`)).toBeVisible();
});

test("the editor offers Try again when it can't load", async ({ page }) => {
  await page.goto(`/calendar?month=${month}`);
  const connection = await flakyConnection(page);
  await page.getByRole("button", { name: "Add event", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Couldn't load the editor")).toBeVisible();
  connection.down = false;
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.getByLabel("Name", { exact: true })).toBeVisible();
});
