"use client";

import { useState } from "react";
import { CONTACT_STATUSES } from "@/types/contact";
import { saveContactsAction } from "@/lib/actions";
import { ContactStatusPicker } from "@/components/ContactStatusPicker";
import { pastDueMeetingDays, summarizeContacts } from "@/lib/contacts";
import { useDebouncedAutosave } from "@/components/useDebouncedAutosave";

let nextRowKey = 0;

const UNGROUPED = "Ungrouped";

// Highlighter Gold at a real fill weight, per the accent's "one thing on the
// view that most needs a second signal" role. A meeting whose date has come
// and gone while the contact still reads "Meeting Set" is the one piece of
// going-quiet the status pill cannot show on its own.
function PastDueMeetingFlag({ contact, todayISO }) {
  const days = pastDueMeetingDays(contact, todayISO);
  if (days === null) return null;

  return (
    <span className="tabular-figures w-fit rounded-xs bg-brand-accent/35 px-1.5 py-0.5 text-[11px] font-semibold text-brand-accent-deep">
      Meeting was {days} {days === 1 ? "day" : "days"} ago
    </span>
  );
}

function formatPhoneInput(raw) {
  const digits = raw.replace(/\D/g, "").slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function ContactsTable({
  semesterId,
  contacts,
  // Stamped once on the server so the overdue math can't drift between the
  // server render and the client's own clock.
  todayISO,
}) {
  const [rows, setRows] = useState(() =>
    contacts.map((c) => ({
      key: `existing-${c.id}`,
      ...c,
      orgGroup: c.org,
      status: c.status ?? CONTACT_STATUSES[0],
    })),
  );

  const { formRef, scheduleSave, statusLabel } = useDebouncedAutosave(
    saveContactsAction,
  );

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

  // Recomputed from live rows, not from the server's copy, so the line tracks
  // the edit an officer just made instead of the page they loaded.
  const summary = summarizeContacts(rows, todayISO);
  const summaryParts = [
    summary.notReachedOut && `${summary.notReachedOut} not reached out`,
    summary.awaitingReply && `${summary.awaitingReply} awaiting reply`,
    summary.meetingPassed && `${summary.meetingPassed} meeting date passed`,
  ].filter(Boolean);

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onChange={scheduleSave}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="semesterId" value={semesterId} />

      {summaryParts.length > 0 && (
        <p className="tabular-figures text-sm text-brand-ink/75">
          {summaryParts.join(" · ")}
        </p>
      )}

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
                        <div className="flex flex-col gap-1">
                          <input
                            type="date"
                            name="contactMeetingDate"
                            // Controlled, unlike the other text fields: the
                            // overdue flag below reads this value, so it has to
                            // update as soon as the date changes.
                            value={row.meetingDate ?? ""}
                            onChange={(e) => {
                              const meetingDate = e.target.value || null;
                              setRows((rs) =>
                                rs.map((r) => (r.key === row.key ? { ...r, meetingDate } : r)),
                              );
                            }}
                            aria-label="Meeting date"
                            className={input}
                          />
                          <PastDueMeetingFlag contact={row} todayISO={todayISO} />
                        </div>
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
          {statusLabel}
        </span>
      </div>
    </form>
  );
}
