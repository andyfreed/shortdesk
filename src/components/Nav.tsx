"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSection, type Section } from "@/lib/section";

const LINKS: Record<Section, { href: string; label: string }[]> = {
  real: [
    { href: "/", label: "Markets" },
    { href: "/radar", label: "Radar" },
    { href: "/trade", label: "Short" },
    { href: "/positions", label: "Positions" },
    { href: "/learn", label: "Learn" },
  ],
  sandbox: [
    { href: "/", label: "Markets" },
    { href: "/radar", label: "Radar" },
    { href: "/bot", label: "Bot" },
    { href: "/learn", label: "Learn" },
  ],
};

export function Nav() {
  const pathname = usePathname();
  const { section, setSection } = useSection();
  const links = LINKS[section];

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded bg-short text-xs font-bold text-white">
            ↓
          </span>
          <span className="hidden md:inline">
            Short<span className="text-muted">Desk</span>
          </span>
        </Link>

        {/* Real / Sandbox section switch */}
        <div className="inline-flex shrink-0 rounded-lg border border-border p-0.5 text-xs">
          {(["real", "sandbox"] as const).map((s) => {
            const active = section === s;
            return (
              <button
                key={s}
                onClick={() => setSection(s)}
                className={`rounded-md px-2 py-1 font-medium transition-colors ${
                  active
                    ? s === "real"
                      ? "bg-short text-white"
                      : "bg-accent text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {s === "real" ? "💵 Real" : "🧪 Sandbox"}
              </button>
            );
          })}
        </div>

        <nav className="no-scrollbar flex items-center gap-1 overflow-x-auto text-sm">
          {links.map((l) => {
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
      </div>
      {/* section color strip — strong visual cue for which world you're in */}
      <div className={section === "real" ? "h-0.5 bg-short" : "h-0.5 bg-accent"} />
    </header>
  );
}
