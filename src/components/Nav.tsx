"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Markets" },
  { href: "/radar", label: "Radar" },
  { href: "/trade", label: "Short" },
  { href: "/positions", label: "Positions" },
  { href: "/bot", label: "Bot" },
  { href: "/learn", label: "Learn" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-short text-xs font-bold text-white">
            ↓
          </span>
          <span className="hidden sm:inline">
            Short<span className="text-muted">Desk</span>
          </span>
        </Link>
        <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`shrink-0 rounded px-2.5 py-1.5 transition-colors ${
                  active
                    ? "bg-surface-2 text-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto hidden items-center gap-2 text-xs text-muted sm:flex">
          <span>Educational • not advice</span>
        </div>
      </div>
    </header>
  );
}
