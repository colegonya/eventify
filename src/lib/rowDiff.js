// What a list editor's autosave sends: only the rows that changed since the
// last save the server accepted, plus the ids of rows removed since then.
// Rows nobody touched stay out of the request, so a save can't write back a
// stale copy of a row another officer just edited.
//
// Works on the FormData the form already produces. Each editor says how to
// tell its rows apart with `rowKey(name, value)`:
//   - a string: this field starts (or names) that row, and belongs to it
//   - undefined: this field belongs to the row named most recently
//   - null: this field isn't part of any row (a hidden semesterId, say) and
//     goes out with every save
// A row's content is compared as the exact list of its fields and values,
// so an unchecked checkbox (which sends nothing) still counts as a change.

export const DELETED_ROW_FIELD = "deletedRow";

function readRows(formData, rowKey) {
  const context = [];
  const rows = new Map();
  let current = null;
  for (const [name, value] of formData.entries()) {
    const key = rowKey(name, value);
    if (key === null) {
      context.push([name, value]);
      continue;
    }
    if (key !== undefined) current = key;
    if (current === null) {
      context.push([name, value]);
      continue;
    }
    if (!rows.has(current)) rows.set(current, []);
    rows.get(current).push([name, value]);
  }
  return { context, rows };
}

const signature = (entries) => JSON.stringify(entries);

/** Each row's content as the form holds it now, for comparing against later. */
export function rowSnapshot(formData, rowKey) {
  const { rows } = readRows(formData, rowKey);
  return new Map([...rows].map(([id, entries]) => [id, signature(entries)]));
}

/**
 * Compares `formData` against `saved` (a rowSnapshot from the last accepted
 * save). Returns the FormData to send, the snapshot to keep once the server
 * accepts it, and whether there's anything to send at all.
 */
export function rowChanges(formData, saved, rowKey) {
  const { context, rows } = readRows(formData, rowKey);
  const payload = new FormData();
  for (const [name, value] of context) payload.append(name, value);

  let changed = 0;
  for (const [id, entries] of rows) {
    if (saved.get(id) === signature(entries)) continue;
    changed++;
    for (const [name, value] of entries) payload.append(name, value);
  }
  let deleted = 0;
  for (const id of saved.keys()) {
    if (rows.has(id)) continue;
    deleted++;
    payload.append(DELETED_ROW_FIELD, id);
  }

  const next = new Map([...rows].map(([id, entries]) => [id, signature(entries)]));
  return { payload, next, empty: changed === 0 && deleted === 0 };
}

/** A rowKey for editors whose rows each start with a hidden id field. */
export const rowsStartingWith = (idField, rowFields) => (name, value) => {
  if (name === idField) return String(value);
  return rowFields.includes(name) ? undefined : null;
};
