import { dollars, fail, field, LIMITS, ok } from "@/lib/validation";

const price = dollars("a price");
const MAX_QUANTITY = 999;

const priceInCents = (raw) => {
  const parsed = price.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return { cents: parsed.data ?? 0 };
};

/**
 * The Drinks tab's catalog editor. Field names are
 * `group::<groupId>::label`, `item::<groupId>::<itemId>::name`, and
 * `item::<groupId>::<itemId>::price`, read in form order, which is what makes
 * the on-screen order the stored order. `existingItemIds` is every item id
 * already saved.
 *
 * Follows the list editors' rule (see lists.js): only Remove deletes. An
 * existing item whose name was cleared, or renamed to match another item, is
 * refused instead of being dropped from the catalog.
 */
export function parseDrinkGroupsForm(formData, existingItemIds) {
  const groups = [];
  const groupById = new Map();
  const itemById = new Map();
  const seenNames = new Map();

  for (const [key, rawValue] of formData.entries()) {
    const parts = key.split("::");
    const value = String(rawValue ?? "").trim();

    if (parts[0] === "group" && parts[2] === "label") {
      if (value.length > LIMITS.shortName) {
        return fail(`Group names can be at most ${LIMITS.shortName} characters.`);
      }
      // A blank group name keeps its items under a placeholder rather than
      // losing them.
      const group = { id: parts[1], label: value || "Untitled group", items: [] };
      groups.push(group);
      groupById.set(group.id, group);
    } else if (parts[0] === "item" && parts[3] === "name") {
      const group = groupById.get(parts[1]);
      const itemId = parts[2];
      if (!group) continue;
      if (!value) {
        if (existingItemIds.has(itemId)) {
          return fail("A drink item needs a name. Use Remove to delete an item.");
        }
        continue;
      }
      if (value.length > LIMITS.name) return fail(`Item names can be at most ${LIMITS.name} characters.`);
      const lower = value.toLowerCase();
      if (seenNames.has(lower)) return fail(`Two items are both named "${value}". Give one a different name.`);
      seenNames.set(lower, itemId);
      const item = { id: itemId, name: value, price: 0 };
      group.items.push(item);
      itemById.set(itemId, item);
    } else if (parts[0] === "item" && parts[3] === "price") {
      const item = itemById.get(parts[2]);
      if (!item) continue;
      const { cents, error } = priceInCents(value);
      if (error) return fail(`${item.name}: ${error}`);
      item.price = cents / 100;
    }
  }

  if (groups.length > LIMITS.rows || itemById.size > LIMITS.rows) {
    return fail(`That's more than the catalog can hold (${LIMITS.rows}).`);
  }
  return ok(groups);
}

/**
 * The Drinks tab's autofill quantities, from fields named
 * `preset::<categoryId>::<itemId>`. Blank or 0 means "none" and is left out.
 */
export function parseDrinkPresetsForm(formData) {
  const presets = {};
  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("preset::")) continue;
    const [, categoryId, itemId] = key.split("::");
    const value = String(rawValue ?? "").trim();
    if (!categoryId || !itemId || value === "") continue;
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
