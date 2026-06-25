"use client";

import { useState, useRef, useId } from "react";
import { EXPLAINERS, type ExplainerKey } from "@/lib/content";

/**
 * A small "?" affordance that reveals the plain-English explanation of a
 * setting. Click to toggle so it works on touch as well as hover.
 */
export function Info({ k }: { k: ExplainerKey }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();
  const ex = EXPLAINERS[k];

  function show() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function hideSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`What is ${ex.title}?`}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={show}
        onMouseLeave={hideSoon}
        onFocus={show}
        onBlur={hideSoon}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted hover:border-accent hover:text-accent"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          onMouseEnter={show}
          onMouseLeave={hideSoon}
          className="absolute left-1/2 top-6 z-50 w-64 -translate-x-1/2 rounded-lg border border-border bg-surface-2 p-3 text-xs leading-relaxed text-foreground shadow-xl"
        >
          <span className="mb-1 block font-semibold">{ex.title}</span>
          <span className="text-muted">{ex.short}</span>
        </span>
      )}
    </span>
  );
}

export function Label({
  children,
  k,
}: {
  children: React.ReactNode;
  k?: ExplainerKey;
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
      {children}
      {k && <Info k={k} />}
    </span>
  );
}
