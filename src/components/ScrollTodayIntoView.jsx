"use client";

import { useEffect } from "react";

/**
 * Centers today's column on a phone, where the month grid is wider than the
 * screen and scrolls sideways.
 *
 * Seven columns at a 110px floor is roughly 770px of grid, so every common
 * phone width lands mid-month with today somewhere off to the side — and
 * PRODUCT.md's stated case for this page is checking it one-handed at an event.
 * The alternatives don't survive contact: week view's columns have a 220px
 * floor, so it scrolls twice as much, and a stacked day-agenda list is the
 * "unrelated stacked-card pattern" DESIGN.md's Layout section rules out.
 */
export function ScrollTodayIntoView({ containerId }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    // Desktop lays all seven columns out at once. Only act where something is
    // genuinely off-screen, which also avoids hardcoding the breakpoint here.
    if (container.scrollWidth <= container.clientWidth) return;

    const cell = container.querySelector("[data-today]");
    if (!cell) return;

    // Measured rects, not offsetLeft, which is relative to whatever positioned
    // ancestor happens to be nearest rather than to the scroll container.
    const cellRect = cell.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    // scrollLeft rather than scrollIntoView: that scrolls every scrollable
    // ancestor, dropping the officer down the page past the month they just
    // opened. Clamps on its own at the first and last column.
    container.scrollLeft +=
      cellRect.left - containerRect.left - (containerRect.width - cellRect.width) / 2;
  }, [containerId]);

  return null;
}
