// The part of autosave that decides when a save goes out, kept free of React
// so it can be tested on its own. useDebouncedAutosave owns the typing delay
// and hands each finished edit here.
//
// Three rules:
//   - One save in flight at a time. An edit made while a save is running
//     goes out right after it, so an older snapshot can never land after a
//     newer one and overwrite it.
//   - A save that throws (network down, server unreachable) is retried after
//     1, 3, then 9 seconds, then waits for a manual retry(). A newer edit
//     replaces the one being retried, since it holds the same fields.
//   - A save the server refuses ({ ok: false }) isn't retried: the same data
//     would be refused again. The officer has to change something.

export const RETRY_DELAYS_MS = [1000, 3000, 9000];

/**
 * Phases, as reported to onStatus:
 *   idle      nothing to save
 *   saving    a save is in flight
 *   saved     the last save went through
 *   retrying  a save failed to reach the server; another attempt is scheduled
 *   failed    every retry failed; waiting on retry() or a new edit
 *   invalid   the server refused the save; `error` says why
 */
export function createSaveQueue({
  save,
  onStatus = () => {},
  onSaved = () => {},
  retryDelays = RETRY_DELAYS_MS,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  // The newest edit not yet sent.
  let pending = null;
  // The edit a failed save was carrying, kept for the next retry.
  let unsent = null;
  let inFlight = false;
  let attempt = 0;
  let retryTimer = null;
  let status = { phase: "idle", error: null };

  const report = (phase, error = null) => {
    status = { phase, error };
    onStatus(status);
  };

  const cancelRetry = () => {
    if (retryTimer !== null) clearTimer(retryTimer);
    retryTimer = null;
  };

  async function run() {
    if (inFlight) return;
    const data = pending ?? unsent;
    if (data === null) return;
    // A fresh edit starts a fresh round of retries.
    if (pending !== null) attempt = 0;
    pending = null;
    unsent = null;
    cancelRetry();
    inFlight = true;
    report("saving");

    let result;
    try {
      result = await save(data);
    } catch {
      inFlight = false;
      if (pending !== null) return run();
      unsent = data;
      if (attempt < retryDelays.length) {
        const delay = retryDelays[attempt];
        attempt += 1;
        report("retrying");
        retryTimer = setTimer(() => {
          retryTimer = null;
          run();
        }, delay);
      } else {
        report("failed");
      }
      return;
    }

    inFlight = false;
    attempt = 0;
    if (result?.ok === false) {
      // A newer edit may already fix what was refused.
      if (pending !== null) return run();
      report("invalid", result.error ?? "The change wasn't saved.");
      return;
    }
    onSaved(result);
    if (pending !== null) return run();
    report("saved");
  }

  return {
    /** Queues the newest version of the form. Replaces any older unsent one. */
    enqueue(data) {
      pending = data;
      unsent = null;
      return run();
    },
    /** Sends the failed edit again now, skipping the rest of the wait. */
    retry() {
      if (unsent === null || inFlight) return Promise.resolve();
      attempt = 0;
      return run();
    },
    /** True while something the officer typed isn't stored yet. */
    hasUnsavedWork() {
      return inFlight || pending !== null || unsent !== null || status.phase === "invalid";
    },
    getStatus: () => status,
    dispose() {
      cancelRetry();
    },
  };
}
