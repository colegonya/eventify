"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CONTACT_STATUSES } from "@/types/contact";
import { CONTACT_STATUS_STYLES, CONTACT_STATUS_HEX } from "@/lib/contactStatusColors";
import { saveContactsAction } from "@/lib/actions";

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
    contacts.map((c) => ({ key: `existing-${c.id}`, ...c })),
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
    "w-full rounded-md border border-brand-ink/20 bg-white px-2 py-1.5 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/30 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

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
  // jump around while someone is mid-edit.
  const groupOrder = [];
  const groups = new Map();
  for (const row of rows) {
    const org = row.org.trim() || UNGROUPED;
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
              className="rounded-xl border border-brand-ink/10 bg-white p-4 shadow-sm"
            >
              <span className="inline-block rounded-md bg-brand-ink/10 px-2 py-1 text-xs font-bold uppercase tracking-wide text-brand-ink">
                {org}
              </span>

              <div className="mt-3 flex flex-col gap-3">
                {orgRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex flex-col gap-2 rounded-lg border border-brand-ink/10 bg-brand-ink/[0.02] p-3"
                  >
                    <input type="hidden" name="contactId" value={row.id} />

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        name="contactOrg"
                        value={row.org}
                        onChange={(e) => {
                          const org = e.target.value;
                          setRows((rs) => rs.map((r) => (r.key === row.key ? { ...r, org } : r)));
                        }}
                        placeholder="Org, e.g. a sorority or partner org"
                        className={`flex-1 ${input}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeRow(row.key)}
                        className="shrink-0 text-sm text-brand-ink/75 hover:text-brand-primary"
                      >
                        Remove
                      </button>
                    </div>

                    <input
                      type="text"
                      name="contactPosition"
                      defaultValue={row.position}
                      placeholder="Name or role, e.g. Social Chair"
                      className={input}
                    />

                    {/* Status gets its own full-width row rather than sharing a
                        two-column row with the phone: the longest option
                        ("Responded/Meeting Set") doesn't fit in half a card at
                        any padding, and was rendering underneath the native
                        dropdown arrow. pr-7 keeps the text clear of that arrow. */}
                    <select
                      name="contactStatus"
                      value={row.status}
                      onChange={(e) => {
                        const status = e.target.value;
                        setRows((rs) =>
                          rs.map((r) => (r.key === row.key ? { ...r, status } : r)),
                        );
                      }}
                      className={`w-full truncate rounded-full border-0 py-1.5 pl-3 pr-7 text-sm font-medium outline-none ${CONTACT_STATUS_STYLES[row.status]}`}
                    >
                      {CONTACT_STATUSES.map((status) => (
                        <option
                          key={status}
                          value={status}
                          style={{ backgroundColor: CONTACT_STATUS_HEX[status], color: "#1e293b" }}
                        >
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      name="contactPhone"
                      defaultValue={row.phone}
                      onChange={(e) => {
                        e.target.value = formatPhoneInput(e.target.value);
                      }}
                      placeholder="(555) 555-5555"
                      className={input}
                    />

                    <div className="grid grid-cols-2 gap-2 items-start">
                      <input
                        type="date"
                        name="contactMeetingDate"
                        defaultValue={row.meetingDate ?? ""}
                        className={input}
                      />
                      <textarea
                        name="contactNotes"
                        defaultValue={row.notes}
                        placeholder="Notes"
                        rows={1}
                        ref={autoResizeNotes}
                        onInput={(e) => autoResizeNotes(e.currentTarget)}
                        className={`${input} resize-none overflow-hidden leading-snug`}
                      />
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
