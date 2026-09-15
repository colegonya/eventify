"use client";

import { useEffect, useRef, useState, useTransition } from "react";

const AUTOSAVE_DELAY_MS = 800;
const SAVED_FLASH_MS = 2000;

/**
 * The autosave every always-editable table on the app uses: wait for typing to
 * stop, post the whole form, then flash "Saved" for a couple of seconds.
 *
 * Four components had their own hand-copied version of this — the three
 * settings-tab editors and the contacts table — which is four places to get
 * the debounce window, the cleanup, or the flash timing subtly different.
 *
 * `onSaved` runs after a successful save, for the one caller that needs to
 * refresh something else on the page afterward.
 */
export function useDebouncedAutosave(saveAction, { onSaved } = {}) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);

  useEffect(
    () => () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    },
    [],
  );

  const scheduleSave = () => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      // The form can unmount during the debounce window, e.g. switching
      // semesters right after an edit.
      if (!formRef.current) return;
      const formData = new FormData(formRef.current);
      startTransition(async () => {
        await saveAction(formData);
        setSaved(true);
        setTimeout(() => setSaved(false), SAVED_FLASH_MS);
        // scheduleSave is rebuilt every render, so this closure always holds
        // the current callback — no ref needed to keep it fresh.
        onSaved?.();
      });
    }, AUTOSAVE_DELAY_MS);
  };

  return {
    formRef,
    scheduleSave,
    isPending,
    saved,
    statusLabel: isPending ? "Saving…" : saved ? "Saved" : "",
  };
}
