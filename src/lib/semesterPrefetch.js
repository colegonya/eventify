/**
 * Starts a semester's data read before the semester list comes back, when the
 * URL already names the semester, so a page waits on the two reads together
 * instead of one after the other.
 *
 * Returns a loader: pass it the semester the page settled on. If that's the
 * one the URL named, it returns the read already in flight; otherwise (no
 * ?semester=, or one that doesn't exist) it starts a fresh one. A discarded
 * early read only ever touched a Redis key and is never shown.
 */
export function prefetchForSemester(requestedId, load) {
  const early = typeof requestedId === "string" && requestedId ? { id: requestedId, promise: load(requestedId) } : null;
  // Unused when the URL named a semester that doesn't exist; don't let its
  // failure surface as an unhandled rejection.
  early?.promise.catch(() => {});
  return (semesterId) => (early && early.id === semesterId ? early.promise : load(semesterId));
}
