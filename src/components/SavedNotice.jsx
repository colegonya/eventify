"use client";

import { useEffect, useRef, useState } from "react";

const VISIBLE_MS = 5000;

/**
 * The "✓ Saved" line shown beside a server-rendered form's button after a
 * successful save. The action redirects back with ?saved=..., and this
 * appears next to the button that was clicked, since that's where the
 * officer is looking.
 *
 * It removes the ?saved= params from the address bar right away, so a
 * refresh or a shared link doesn't show it again, scrolls itself into view
 * in case the reload moved the page, and fades after five seconds.
 *
 * Call sites key it on the redirect's `at` timestamp, so saving the same
 * form twice in a row remounts it and shows the notice again.
 */
export function SavedNotice({ show, children, params = ["saved", "id", "at"] }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) return;
    ref.current?.scrollIntoView({ block: "nearest" });

    const url = new URL(window.location.href);
    for (const param of params) url.searchParams.delete(param);
    window.history.replaceState(window.history.state, "", url);

    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
    // `params` is a constant per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  if (!show) return null;
  return (
    <span
      ref={ref}
      role="status"
      className={`inline-flex items-center gap-1 text-sm font-medium text-green-800 transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <span aria-hidden>✓</span>
      {children}
    </span>
  );
}
