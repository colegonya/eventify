import { dollars, fail, field, LIMITS, ok } from "@/lib/validation";
import { parseDeletedRows } from "@/lib/forms/lists";
import { GROUP_ROW, ITEM_ROW } from "@/lib/forms/rowKeys";

const price = dollars("a price");
const MAX_QUANTITY = 999;

const priceInCents = (raw) => {
  const parsed = price.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { cents: parsed.data ?? 0 };
};

/**
 * The Drinks tab's catalog editor. It sends only the groups and items that
 * changed, as `group::<groupId>::label`, `item::<groupId>::<itemId>::name`
 * and `item::<groupId>::<itemId>::price`, plus removed rows (see
 * forms/rowKeys.js). `stored` is the saved catalog: `{ groups, items }`, the
 * records as getDrinkCatalogRecords returns them.
 *
 * Follows the list editors' rule (see lists.js): only Remove deletes. An
 * existing item whose name was cleared, or renamed to match another item, is
 * refused instead of being dropped from the catalog.
 *
 * Returns the group and item records to write, and the ids to delete.
 * Deleting a group also deletes every stored item in it, including one
 * another officer added after this page loaded.
 */
export function parseDrinkGroupsForm(formData, stored) {
  const deleted = parseDeletedRows(formData, GROUP_ROW);
  if (!deleted.ok) return deleted;
  const deletedItems = parseDeletedRows(formData, ITEM_ROW);
  if (!deletedItems.ok) return deletedItems;
  const deletedGroupIds = new Set(deleted.data);

  const groups = [];
  const items = [];
  const itemById = new Map();
  const liveGroupIds = new Set(stored.groups.map((g) => g.id).filter((id) => !deletedGroupIds.has(id)));
  const existingItemIds = new Set(stored.items.map((item) => item.id));

  for (const [key, rawValue] of formData.entries()) {
    const parts = key.split("::");
    const value = String(rawValue ?? "").trim();

    if (parts[0] === "group" && parts[2] === "label") {
      if (value.length > LIMITS.shortName) {
        return fail(`Group names can be at most ${LIMITS.shortName} characters.`);
      }
      // A blank group name keeps its items under a placeholder rather than
      // losing them.
      groups.push({ id: parts[1], label: value || "Untitled group" });
      liveGroupIds.add(parts[1]);
    } else if (parts[0] === "item" && parts[3] === "name") {
      const [, groupId, itemId] = parts;
      if (!value) {
        if (existingItemIds.has(itemId)) {
          return fail("A drink item needs a name. Use Remove to delete an item.");
        }
        continue;
      }
      if (!liveGroupIds.has(groupId)) {
        return fail("That drink group was deleted. Reload the page to see the current catalog.");
      }
      if (value.length > LIMITS.name) return fail(`Item names can be at most ${LIMITS.name} characters.`);
      const item = { id: itemId, groupId, name: value, price: 0 };
      items.push(item);
      itemById.set(itemId, item);
    } else if (parts[0] === "item" && parts[3] === "price") {
      const item = itemById.get(parts[2]);
      if (!item) continue;
      const { cents, error } = priceInCents(value);
      if (error) return fail(`${item.name}: ${error}`);
      item.price = cents / 100;
    }
  }

  // Names are checked against the whole catalog as it will be after this
  // save, not only the rows sent, since most rows aren't sent.
  const deletedItemIds = new Set(deletedItems.data);
  for (const item of stored.items) {
    if (deletedGroupIds.has(item.groupId)) deletedItemIds.add(item.id);
  }
  const catalog = new Map(
    stored.items
      .filter((item) => !deletedItemIds.has(item.id) && liveGroupIds.has(item.groupId))
      .map((item) => [item.id, item]),
  );
  for (const item of items) catalog.set(item.id, item);
  const seen = new Set();
  for (const item of catalog.values()) {
    const lower = item.name.toLowerCase();
    if (seen.has(lower)) return fail(`Two items are both named "${item.name}". Give one a different name.`);
    seen.add(lower);
  }

  if (liveGroupIds.size > LIMITS.rows || catalog.size > LIMITS.rows) {
    return fail(`That's more than the catalog can hold (${LIMITS.rows}).`);
  }
  return ok({ groups, items, deletedGroupIds: [...deletedGroupIds], deletedItemIds: [...deletedItemIds] });
}

/**
 * The Drinks tab's autofill quantities, from fields named
 * `preset::<categoryId>::<itemId>`, for the category cards that changed.
 * Every category sent is in the result with its full set of quantities;
 * blank or 0 means "none" and is left out, so a category with none left
 * maps to {}.
 */
export function parseDrinkPresetsForm(formData) {
  const presets = {};
  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("preset::")) continue;
    const [, categoryId, itemId] = key.split("::");
    const value = String(rawValue ?? "").trim();
    if (!categoryId || !itemId) continue;
    presets[categoryId] ??= {};
    if (value === "") continue;
    if (!/^\d+$/.test(value) || Number(value) > MAX_QUANTITY) {
      return fail(`Quantities must be whole numbers from 0 to ${MAX_QUANTITY}.`);
    }
    const qty = Number(value);
    if (qty === 0) continue;
    presets[categoryId] = { ...presets[categoryId], [itemId]: qty };
  }
  return ok(presets);
}

/** One item added from an event's drink calculator. `groups` is the saved catalog. */
export function parseNewDrinkItem(formData, groups) {
  const name = field(formData, "itemName");
  const groupId = field(formData, "itemGroupId");
  if (!name) return fail("Give the item a name.");
  if (name.length > LIMITS.name) return fail(`Item names can be at most ${LIMITS.name} characters.`);
  if (!groups.some((g) => g.id === groupId)) return fail("Pick a group for the item.");
  const lower = name.toLowerCase();
  if (groups.some((g) => g.items.some((item) => item.name.toLowerCase() === lower))) {
    return fail(`There's already an item named "${name}".`);
  }
  const rawPrice = field(formData, "itemPrice");
  if (!rawPrice) return fail("Enter a price for the item.");
  const { cents, error } = priceInCents(rawPrice);
  if (error) return fail(error);
  return ok({ id: field(formData, "itemId") || crypto.randomUUID(), groupId, name, price: cents / 100 });
}
