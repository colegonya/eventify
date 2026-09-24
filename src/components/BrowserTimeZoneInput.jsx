"use client";

import { useEffect, useRef } from "react";

/**
 * A hidden field carrying this browser's time zone, e.g. "America/Chicago",
 * so first-run setup can record what "today" means for the organization
 * without asking. Filled in after hydration; if it never is, the server
 * falls back to a default that Settings can change.
 */
export function BrowserTimeZoneInput({ name = "timeZone" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  }, []);
  return <input ref={ref} type="hidden" name={name} defaultValue="" />;
}
