"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CONTACT_STATUSES } from "@/types/contact";
import { saveContactsAction } from "@/lib/actions";
import { ContactStatusPicker } from "@/components/ContactStatusPicker";

let nextRowKey = 0;

const UNGROUPED = "Ungrouped";

function formatPhoneInput(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function ContactsTable({
  semesterId,
  contacts,
}) {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(() =>
    contacts.map((c) => ({
      key: `existing-${c.id}`,
      ...c,
      orgGroup: c.org,
      status: c.status ?? CONTACT_STATUSES[0],
    })),
  );
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);

  const scheduleSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      startTransition(async () => {
        await saveContactsAction(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      });
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  const input =
    "w-full rounded-sm border border-brand-ink/20 bg-background px-2 py-1.5 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/30 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

  const autoResizeNotes = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      {
        key: `new-${nextRowKey++}`,
        id: crypto.randomUUID(),
        semesterId,
        org: "",
        orgGroup: "",
        position: "",
        status: "Not Reached Out",
        phone: "",
        meetingDate: null,
        notes: "",
      },
    ]);

  const removeRow = (key) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    scheduleSave();
  };

  // Contacts are grouped by their own free-text org name — chapters aren't
  // limited to a fixed list of sororities/orgs, they name their own groups
  // just by typing one in. Order follows first appearance so cards don't
  // jump around while someone is mid-edit. Grouping uses orgGroup (committed
  // on blur) rather than the live org value, otherwise every keystroke moves
  // the row into a new group card and unmounts the input mid-type.
  const groupOrder = [];
  const groups = new Map();
  for (const row of rows) {
    const org = row.orgGroup.trim() || UNGROUPED;
    if (!groups.has(org)) {
      groupOrder.push(org);
      groups.set(org, []);
    }
    groups.get(org).push(row);
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onChange={scheduleSave}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="semesterId" value={semesterId} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groupOrder.map((org) => {
          const orgRows = groups.get(org);
          return (
            <div
              key={org}
              className="rounded-md border border-paper-line bg-background p-4 shadow-[var(--shadow-resting)]"
            >
              <span className="inline-block rounded-xs bg-brand-ink/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-ink">
                {org}
              </span>

              <div className="mt-3 flex flex-col divide-y divide-paper-line">
                {orgRows.map((row, rowIndex) => (
                  <div
                    key={row.key}
                    className="flex flex-col gap-2 pt-5 pb-5 first:pt-0 last:pb-0"
                  >
                    <input type="hidden" name="contactId" value={row.id} />

                    {/* The person's own name/role leads each contact block, not
                        the org field — every block in this card shares the same
                        org text, so leading with that made every contact look
                        identical at a glance. Leading with what's actually
                        different (who they are) is what tells two people apart. */}
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-ink/10 text-[11px] font-semibold text-brand-ink/60"
                      >
                        {rowIndex + 1}
                      </span>
                      <input
                        type="text"
                        name="contactPosition"
                        defaultValue={row.position}
                        aria-label="Contact name or role"
                        placeholder="Name or role, e.g. Social Chair"
                        className={`flex-1 rounded-sm border border-brand-ink/20 bg-background px-2 py-1.5 text-[15px] font-semibold text-brand-ink outline-none transition-colors placeholder:text-brand-ink/30 placeholder:font-normal focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15`}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="shrink-0 text-sm text-brand-ink/75 transition-colors hover:text-brand-primary"
                      >
                        Remove
                      </button>
                    </div>

                    {/* Hangs everything else that belongs to this contact under
                        the badge, the way a numbered list item's body indents
                        under its number — a visual "this is all one person"
                        boundary the flat field stack didn't have. */}
                    <div className="ml-8 flex flex-col gap-2">
                      <input
                        type="text"
                        name="contactOrg"
                        value={row.org}
                        onChange={(e) => {
                          const org = e.target.value;
                          setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, org } : r)));
                        }}
                        onBlur={(e) => {
                          const orgGroup = e.target.value;
                          setRows((rs) =>
                            rs.map((r) => (r.key === row.key ? { ...r, orgGroup } : r)),
                          );
                        }}
                        aria-label="Organization"
                        placeholder="Org, e.g. a sorority or partner org"
                        className={input}
                      />

                      {/* Status gets its own full-width row rather than sharing a
                          two-column row with the phone: the longest option
                          ("Responded/Meeting Set") doesn't fit in half a card at
                          any padding. */}
                      <ContactStatusPicker
                        name="contactStatus"
                        value={row.status}
                        onChange={(status) => {
                          setRows((rs) =>
                            rs.map((r) => (r.key === row.key ? { ...r, status } : r)),
                          );
                          scheduleSave();
                        }}
                      />
                      <input
                        type="text"
                        name="contactPhone"
                        defaultValue={row.phone}
                        onChange={(e) => {
                          e.target.value = formatPhoneInput(e.target.value);
                        }}
                        aria-label="Phone number"
                        placeholder="(555) 555-5555"
                        className={input}
                      />

                      <div className="grid grid-cols-2 gap-2 items-start">
                        <input
                          type="date"
                          name="contactMeetingDate"
                          defaultValue={row.meetingDate ?? ""}
                          aria-label="Meeting date"
                          className={input}
                        />
                        <textarea
                          name="contactNotes"
                          defaultValue={row.notes}
                          aria-label="Notes"
                          placeholder="Notes"
                          rows={1}
                          ref={autoResizeNotes}
                          onInput={(e) => autoResizeNotes(e.currentTarget)}
                          className={`${input} resize-none overflow-hidden leading-snug`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={addRow}
          className="self-start text-sm font-medium text-brand-primary hover:underline"
        >
          + Add contact
        </button>
        <span className="text-sm text-brand-ink/75">
          {isPending ? "Saving…" : saved ? "Saved" : ""}
        </span>
      </div>
    </form>
  );
}
