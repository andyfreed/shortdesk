"use client";

import type { EquityPoint } from "@/lib/bot";

/** Tiny inline equity-curve sparkline with a starting-balance baseline. */
export function EquityChart({
  points,
  start,
}: {
  points: EquityPoint[];
  start: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted">
        Equity curve appears once it has run a little.
      </div>
    );
  }
  const w = 600;
  const h = 96;
  const pad = 4;
  const es = points.map((p) => p.e);
  const min = Math.min(...es, start);
  const max = Math.max(...es, start);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / (points.length - 1)) * (w - 2 * pad);
  const y = (e: number) => pad + (1 - (e - min) / span) * (h - 2 * pad);
  const path = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.e).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1].e >= start;
  const startY = y(start);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      <line
        x1={pad}
        x2={w - pad}
        y1={startY}
        y2={startY}
        stroke="var(--border)"
        strokeDasharray="4 4"
      />
      <path
        d={path}
        fill="none"
        stroke={up ? "var(--long)" : "var(--short)"}
        strokeWidth={2}
      />
    </svg>
  );
}
