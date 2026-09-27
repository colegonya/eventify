// Helpers for records stored one per hash field (see keys.js). Relative
// imports only, like keys.js, since migrate.js loads this through plain Node.

/** A hash read back as a list. A missing hash (HGETALL gives null) is empty. */
export function hashValues(hash) {
  return hash ? Object.values(hash) : [];
}

/**
 * Redis doesn't keep a hash's fields in any order you can rely on, so lists
 * shown in the order officers built them carry a `sortOrder`. Ties (two new
 * rows saved at the same moment by two officers) fall back to the id, so the
 * order is at least the same on every load.
 */
export function bySortOrder(a, b) {
  const pa = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const pb = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
  if (pa !== pb) return pa - pb;
  return String(a.id).localeCompare(String(b.id));
}

export function inSortOrder(hash) {
  return hashValues(hash).sort(bySortOrder);
}

/**
 * Gives each incoming record a sortOrder: an existing record keeps the one it
 * has, and new ones go after everything stored, in the order given.
 * `existing` is the stored list.
 */
export function withSortOrders(existing, incoming) {
  const stored = new Map(existing.map((r) => [r.id, r]));
  let next = existing.reduce((max, r) => Math.max(max, r.sortOrder ?? -1), -1) + 1;
  return incoming.map((record) => {
    const sortOrder = stored.get(record.id)?.sortOrder;
    return { ...record, sortOrder: sortOrder ?? next++ };
  });
}

/** `{ [id]: record }`, the shape HSET takes for many fields at once. */
export function byId(records) {
  return Object.fromEntries(records.map((r) => [r.id, r]));
}

/**
 * The drink catalog as the app uses it: groups in order, each holding its
 * items in order. Stored as two hashes so that adding an item from an event
 * and repricing another on the Drinks tab touch different records. An item
 * whose group is gone (deleted while another officer was adding to it) is
 * left out.
 */
export function assembleDrinkGroups(groupsHash, itemsHash) {
  const groups = inSortOrder(groupsHash).map((g) => ({ id: g.id, label: g.label, items: [] }));
  const byGroup = new Map(groups.map((g) => [g.id, g]));
  for (const item of inSortOrder(itemsHash)) {
    byGroup.get(item.groupId)?.items.push({ id: item.id, name: item.name, price: item.price });
  }
  return groups;
}

/** The reverse of assembleDrinkGroups: nested groups to the two stored lists. */
export function splitDrinkGroups(groups) {
  const groupRecords = [];
  const itemRecords = [];
  groups.forEach((group, groupIndex) => {
    groupRecords.push({ id: group.id, label: group.label, sortOrder: groupIndex });
    for (const item of group.items ?? []) {
      itemRecords.push({
        id: item.id,
        groupId: group.id,
        name: item.name,
        price: item.price,
        sortOrder: itemRecords.length,
      });
    }
  });
  return { groupRecords, itemRecords };
}
