"use client";

import { useState } from "react";
import { saveMarkersAction } from "@/lib/actions";
import { sortMarkers } from "@/lib/markers";
import { useDebouncedAutosave } from "@/components/useDebouncedAutosave";
import { useModalDialog } from "@/components/useModalDialog";

let nextRowKey = 0;

const inputClass =
  "rounded-sm border border-brand-ink/20 bg-background px-2 py-1.5 text-sm text-brand-ink outline-none transition-colors placeholder:text-brand-ink/30 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15";

function MarkersEditor({ semesterId, markers, onClose }) {
  // Sorted once, at mount. Re-sorting as someone types a date would move the
  // row out from under the cursor, the same reason the contacts table freezes
  // its grouping order.
  const [rows, setRows] = useState(() =>
    sortMarkers(markers).map((m) => ({ key: `existing-${m.id}`, ...m })),
  );

  const { formRef, scheduleSave, statusLabel } = useDebouncedAutosave(saveMarkersAction);

  const addRow = () =>
    setRows((rs) => [
      ...rs,
      { key: `new-${nextRowKey++}`, id: crypto.randomUUID(), semesterId, date: "", label: "" },
    ]);

  const removeRow = (key) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    scheduleSave();
  };

  return (
    <form
      ref={formRef}
      onSubmit={(e) => e.preventDefault()}
      onChange={scheduleSave}
      className="mx-auto flex max-w-lg flex-col gap-5 rounded-lg border border-paper-line bg-background p-5 shadow-[var(--shadow-overlay)] md:p-7"
    >
      <input type="hidden" name="semesterId" value={semesterId} />

      <div className="flex items-center justify-between border-b border-paper-line pb-4">
        <h2 id="markers-editor-title" className="text-xl font-bold tracking-tight text-brand-ink">
          Calendar markers
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-brand-ink/75 transition-colors hover:text-brand-primary hover:underline"
        >
          Close ✕
        </button>
      </div>

      <p className="-mt-2 text-sm text-brand-ink/75">
        Dates worth planning around that aren&apos;t events of your own: a rivalry
        game, finals week, move-in day. They show on the calendar and carry no
        budget.
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-brand-ink/60">Nothing marked this term yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-paper-line">
          {rows.map((row) => (
            <div key={row.key} className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
              <input type="hidden" name="markerId" value={row.id} />
              <input
                type="date"
                name="markerDate"
                defaultValue={row.date}
                aria-label="Marker date"
                className={`${inputClass} w-40 shrink-0`}
              />
              <input
                type="text"
                name="markerLabel"
                defaultValue={row.label}
                aria-label="Marker label"
                placeholder="e.g. Homecoming"
                className={`${inputClass} flex-1`}
              />
              <button
                type="button"
                onClick={() => removeRow(row.key)}
                className="shrink-0 text-sm text-brand-ink/75 transition-colors hover:text-brand-primary"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-paper-line pt-4">
        <button
          type="button"
          onClick={addRow}
          className="text-sm font-medium text-brand-primary transition-colors hover:underline"
        >
          + Add marker
        </button>
        <span className="text-sm text-brand-ink/75">{statusLabel}</span>
      </div>
    </form>
  );
}

/**
 * Toolbar button plus its dialog. Local state rather than a URL param, unlike
 * the event and equipment editors: those are deep-linked from Budget alerts,
 * and this has nothing to link to.
 */
export function MarkersDialog({ semesterId, markers }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const dialogRef = useModalDialog(open, close);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-sm border border-brand-ink/20 bg-background px-2.5 py-1.5 text-sm text-brand-ink transition-colors hover:bg-surface-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
      >
        <span aria-hidden className="h-2.5 w-2.5 rounded-xs border border-dashed border-brand-ink/60" />
        Markers
      </button>

      {open && (
        <div
          className="animate-scrim-in fixed inset-0 z-50 overflow-y-auto bg-brand-ink/40 p-4 backdrop-blur-sm"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="markers-editor-title"
            tabIndex={-1}
            className="animate-panel-in mx-auto my-8 w-full max-w-lg outline-none"
          >
            <MarkersEditor semesterId={semesterId} markers={markers} onClose={close} />
          </div>
        </div>
      )}
    </>
  );
}
