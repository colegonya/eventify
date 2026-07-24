"use client";

import { useState } from "react";
import { centsToDisplay } from "@/lib/budget";

const SIZE = 680;
const CENTER = SIZE / 2;
const RING_RADIUS = 120;
const BAND_WIDTH = 34;
const OUTER_RADIUS = RING_RADIUS + BAND_WIDTH / 2;
const INNER_RADIUS = RING_RADIUS - BAND_WIDTH / 2;
const CORNER_RADIUS = 8;
const GAP_DEG = 4;
const INNER_GAP_DEG = 1.5;
const MIN_VISUAL_DEG = 14;
const ELBOW = 22;
const EXTEND = 46;
const LABEL_OVERLAP_Y = 30;
const LABEL_PUSH_STEP = 26;
const LABEL_MAX_PUSH_ITER = 6;

// Math.cos/sin can return a last-bit-different result between the server's
// V8 and the browser's V8 for the same input, which is enough to make the
// SSR-rendered path string mismatch the client's on hydration. Rounding
// collapses those differences so both environments produce identical output.
function pointAt(angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: Math.round((CENTER + radius * Math.cos(rad)) * 100) / 100,
    y: Math.round((CENTER + radius * Math.sin(rad)) * 100) / 100,
  };
}

// A donut segment as a filled shape with a small fixed corner radius on all
// four corners — a "soft rounded rectangle" bent into an arc, rather than a
// thick stroke with fully-round (pill) end caps.
function describeRoundedSegment(startDeg, endDeg) {
  const sweep = endDeg - startDeg;
  const maxInset = sweep / 2 - 0.01;
  const outerInsetDeg = Math.min((CORNER_RADIUS / OUTER_RADIUS) * (180 / Math.PI), maxInset);
  const innerInsetDeg = Math.min((CORNER_RADIUS / INNER_RADIUS) * (180 / Math.PI), maxInset);

  const outerStartCorner = pointAt(startDeg, OUTER_RADIUS);
  const outerEndCorner = pointAt(endDeg, OUTER_RADIUS);
  const innerEndCorner = pointAt(endDeg, INNER_RADIUS);
  const innerStartCorner = pointAt(startDeg, INNER_RADIUS);

  const p1a = pointAt(startDeg + outerInsetDeg, OUTER_RADIUS);
  const p2a = pointAt(endDeg - outerInsetDeg, OUTER_RADIUS);
  const p2b = pointAt(endDeg, OUTER_RADIUS - CORNER_RADIUS);
  const p3a = pointAt(endDeg, INNER_RADIUS + CORNER_RADIUS);
  const p3b = pointAt(endDeg - innerInsetDeg, INNER_RADIUS);
  const p4a = pointAt(startDeg + innerInsetDeg, INNER_RADIUS);
  const p4b = pointAt(startDeg, INNER_RADIUS + CORNER_RADIUS);
  const p1b = pointAt(startDeg, OUTER_RADIUS - CORNER_RADIUS);

  const outerLargeArc = sweep - outerInsetDeg * 2 > 180 ? 1 : 0;
  const innerLargeArc = sweep - innerInsetDeg * 2 > 180 ? 1 : 0;

  return [
    `M ${p1a.x} ${p1a.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${outerLargeArc} 1 ${p2a.x} ${p2a.y}`,
    `Q ${outerEndCorner.x} ${outerEndCorner.y} ${p2b.x} ${p2b.y}`,
    `L ${p3a.x} ${p3a.y}`,
    `Q ${innerEndCorner.x} ${innerEndCorner.y} ${p3b.x} ${p3b.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${innerLargeArc} 0 ${p4a.x} ${p4a.y}`,
    `Q ${innerStartCorner.x} ${innerStartCorner.y} ${p4b.x} ${p4b.y}`,
    `L ${p1b.x} ${p1b.y}`,
    `Q ${outerStartCorner.x} ${outerStartCorner.y} ${p1a.x} ${p1a.y}`,
    "Z",
  ].join(" ");
}

export function BudgetCategoryPieChart({ slices, totalCents }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (slices.length === 0 || totalCents <= 0) {
    return null;
  }

  // Tiny slices get a floor angle so their rounded ends don't collapse into a
  // dot once a gap is trimmed off each side; larger slices absorb the
  // difference via the renormalization below. Percentage labels stay accurate
  // to the real value regardless of this visual floor.
  const rawSweeps = slices.map((slice) => (slice.amountCents / totalCents) * 360);
  const visualSweeps =
    slices.length > 1 ? rawSweeps.map((sweep) => Math.max(sweep, MIN_VISUAL_DEG)) : rawSweeps;
  const scale = 360 / visualSweeps.reduce((sum, sweep) => sum + sweep, 0);

  const scaledSweeps = visualSweeps.map((sweep) => sweep * scale);
  const rawArcs = slices.map((slice, i) => {
    const startAngle = scaledSweeps.slice(0, i).reduce((sum, sweep) => sum + sweep, 0);
    const sweep = scaledSweeps[i];
    const endAngle = startAngle + sweep;
    return { ...slice, startAngle, endAngle, midAngle: startAngle + sweep / 2 };
  });

  const n = rawArcs.length;
  const withGaps = rawArcs.map((arc, i) => {
    const prev = rawArcs[(i - 1 + n) % n];
    const next = rawArcs[(i + 1) % n];
    const startGap = n > 1 ? (arc.groupId && arc.groupId === prev.groupId ? INNER_GAP_DEG : GAP_DEG) : 0;
    const endGap = n > 1 ? (arc.groupId && arc.groupId === next.groupId ? INNER_GAP_DEG : GAP_DEG) : 0;
    const drawStart = arc.startAngle + startGap / 2;
    const drawEnd = Math.max(arc.endAngle - endGap / 2, drawStart + 0.001);
    const dirRight = pointAt(arc.midAngle, OUTER_RADIUS + ELBOW).x >= CENTER;
    return { ...arc, drawStart, drawEnd, dirRight };
  });

  // Small slices tend to cluster near the top seam, where they'd otherwise
  // stack labels on top of each other. Push a label's leader line further out
  // (in angular order, so wrap-around near the top is checked too) until it
  // clears every label already placed on the same side.
  const placedY = { left: [], right: [] };
  const arcs = withGaps.map((arc) => {
    const side = arc.dirRight ? "right" : "left";
    let push = 0;
    let elbowPoint = pointAt(arc.midAngle, OUTER_RADIUS + ELBOW);
    let labelEnd = { x: elbowPoint.x + (arc.dirRight ? EXTEND : -EXTEND), y: elbowPoint.y };
    for (let iter = 0; iter < LABEL_MAX_PUSH_ITER; iter++) {
      const collides = placedY[side].some((y) => Math.abs(y - labelEnd.y) < LABEL_OVERLAP_Y);
      if (!collides) break;
      push += LABEL_PUSH_STEP;
      elbowPoint = pointAt(arc.midAngle, OUTER_RADIUS + ELBOW + push);
      labelEnd = { x: elbowPoint.x + (arc.dirRight ? EXTEND : -EXTEND), y: elbowPoint.y };
    }
    placedY[side].push(labelEnd.y);
    return {
      ...arc,
      leaderStart: pointAt(arc.midAngle, OUTER_RADIUS),
      elbowPoint,
      labelEnd,
    };
  });

  const active = activeIndex !== null ? arcs[activeIndex] : null;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-brand-ink/10 bg-white p-5 shadow-sm sm:flex-row sm:items-stretch sm:justify-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="aspect-square w-full max-w-[510px] shrink-0"
      >
        {arcs.map((arc, i) => (
          <g
            key={arc.category}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            onClick={() => setActiveIndex(activeIndex === i ? null : i)}
            className="cursor-pointer"
          >
            <path
              d={describeRoundedSegment(arc.drawStart, arc.drawEnd)}
              fill={arc.color}
              opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
              className="transition-opacity"
            />
            <path
              d={`M ${arc.leaderStart.x} ${arc.leaderStart.y} L ${arc.elbowPoint.x} ${arc.elbowPoint.y} L ${arc.labelEnd.x} ${arc.labelEnd.y}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5}
              opacity={activeIndex === null || activeIndex === i ? 1 : 0.35}
              className="transition-opacity"
            />
            <circle cx={arc.labelEnd.x} cy={arc.labelEnd.y} r={5} fill={arc.color} />
            <text
              x={arc.labelEnd.x + (arc.dirRight ? 10 : -10)}
              y={arc.labelEnd.y}
              textAnchor={arc.dirRight ? "start" : "end"}
              dominantBaseline="middle"
              className="text-[22px] font-semibold fill-brand-ink"
            >
              {Math.round(arc.pct)}%
            </text>
          </g>
        ))}
      </svg>

      <div className="flex min-w-[180px] flex-col gap-1 sm:justify-center">
        {active ? (
          <>
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: active.color }}
              />
              <span className="text-sm font-semibold text-brand-ink">{active.category}</span>
            </div>
            <div className="text-2xl font-semibold text-brand-ink">
              {centsToDisplay(active.amountCents)}
            </div>
            <div className="text-xs text-brand-ink/75">
              {Math.round(active.pct)}% of expected spend
            </div>
          </>
        ) : (
          <>
            <div className="text-sm text-brand-ink/75">Expected spend by category</div>
            <div className="text-2xl font-semibold text-brand-ink">
              {centsToDisplay(totalCents)}
            </div>
            <div className="text-xs text-brand-ink/75">Hover a slice for details</div>
          </>
        )}
      </div>
    </div>
  );
}
