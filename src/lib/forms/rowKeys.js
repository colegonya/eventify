import { rowsStartingWith } from "@/lib/rowDiff";

// How each list editor's form splits into rows, for sending only the rows
// that changed (see lib/rowDiff.js). Shared with the server actions, which
// read removed rows back by these same ids.

export const contactRows = rowsStartingWith("contactId", [
  "contactOrg",
  "contactPosition",
  "contactStatus",
  "contactPhone",
  "contactMeetingDate",
  "contactNotes",
]);

export const categoryRows = rowsStartingWith("categoryId", [
  "categoryColor",
  "categoryLabel",
  "categoryNetsRevenue",
  "categoryExcludeFromBudgetTotal",
  "categoryIsOtherOrgCategory",
]);

export const markerRows = rowsStartingWith("markerId", ["markerDate", "markerLabel"]);

// The drink catalog has two kinds of row, so the ids carry a prefix:
// `group::<groupId>::label` is row "g:<groupId>", and an item's name and
// price fields, `item::<groupId>::<itemId>::…`, are row "i:<itemId>".
export const GROUP_ROW = "g:";
export const ITEM_ROW = "i:";
export const drinkCatalogRows = (name) => {
  const parts = name.split("::");
  if (parts[0] === "group") return `${GROUP_ROW}${parts[1]}`;
  if (parts[0] === "item") return `${ITEM_ROW}${parts[2]}`;
  return null;
};

// One row per category card: every `preset::<categoryId>::<itemId>` field.
export const drinkPresetRows = (name) => (name.startsWith("preset::") ? name.split("::")[1] : null);
