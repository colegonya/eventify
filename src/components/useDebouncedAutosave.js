"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createSaveQueue } from "@/lib/saveQueue";

const AUTOSAVE_DELAY_MS = 800;
const SAVED_FLASH_MS = 2000;

const LABELS = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  retrying: "Connection lost. Retrying…",
  failed: "Not saved",
};

/**
 * The autosave every always-editable table on the app uses: wait for typing to
 * stop, post the whole form, then flash "Saved" for a couple of seconds, or
 * show why the save didn't go through until a later one does.
 *
 * When saves go out, and how failures are retried, is lib/saveQueue.js. This
 * hook adds the typing delay and two ways an edit could otherwise be lost:
 *   - Leaving the page (or closing the dialog) inside the typing delay sends
 *     the edit right away instead of dropping it with the timer. If that
 *     save fails for good, a toast says so, since the status line is gone.
 *   - Closing the tab with an edit that isn't stored asks the browser to
 *     confirm first.
 *
 * `onSaved` runs after a successful save, for the one caller that needs to
 * refresh something else on the page afterward.
 *
 * Returns `status`, the props for <AutosaveStatus>.
 */
export function useDebouncedAutosave(saveAction, { onSaved } = {}) {
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState(null);
  // Counts successful saves; "Saved" shows until the flash for the latest
  // one runs out.
  const [savedCount, setSavedCount] = useState(0);
  const [fadedCount, setFadedCount] = useState(0);
  const formRef = useRef(null);
  const saveTimeout = useRef(null);
  const mounted = useRef(false);

  // Read at save time, so the queue always calls the current props.
  const latest = useRef({ saveAction, onSaved });
  useEffect(() => {
    latest.current = { saveAction, onSaved };
  });

  // Built on first use, never during render, so it can close over refs.
  const queueRef = useRef(null);
  const getQueue = () => {
    queueRef.current ??= createSaveQueue({
      save: (formData) => latest.current.saveAction(formData),
      onSaved: () => latest.current.onSaved?.(),
      onStatus: (status) => {
        // A save sent on the way out can still fail after the editor is
        // gone. The status line went with it, so say so in a toast.
        if (!mounted.current) {
          if (status.phase === "failed") {
            toast.error("Your last change wasn't saved. Check your connection, then make it again.");
          } else if (status.phase === "invalid") {
            toast.error(`Your last change wasn't saved: ${status.error}`);
          }
        }
        setPhase(status.phase);
        setError(status.error);
        if (status.phase === "saved") setSavedCount((n) => n + 1);
      },
    });
    return queueRef.current;
  };

  useEffect(() => {
    if (phase !== "saved") return;
    const timer = setTimeout(() => setFadedCount(savedCount), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [phase, savedCount]);

  const sendNow = () => {
    if (saveTimeout.current === null) return;
    clearTimeout(saveTimeout.current);
    saveTimeout.current = null;
    // The form can be gone already, e.g. a semester switch that replaced it.
    if (formRef.current) getQueue().enqueue(new FormData(formRef.current));
  };
  const sendNowRef = useRef(sendNow);
  useEffect(() => {
    sendNowRef.current = sendNow;
  });

  // A layout-effect cleanup runs before React detaches the form's ref on
  // unmount, so the last edit can still be read and sent. A passive effect's
  // cleanup would find formRef already null.
  // The queue isn't stopped here: a save that's retrying keeps retrying
  // after the editor closes.
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      sendNowRef.current();
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (saveTimeout.current === null && !queueRef.current?.hasUnsavedWork()) return;
      e.preventDefault();
      // Older browsers only show the prompt when this is set.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const scheduleSave = () => {
    if (saveTimeout.current !== null) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(sendNow, AUTOSAVE_DELAY_MS);
  };

  let label = LABELS[phase];
  if (phase === "saved" && fadedCount === savedCount) label = "";
  if (phase === "invalid") label = `Not saved: ${error}`;
  const isError = phase === "invalid" || phase === "failed";

  return {
    formRef,
    scheduleSave,
    status: {
      label,
      error: isError,
      onRetry: phase === "failed" ? () => getQueue().retry() : null,
    },
  };
}
