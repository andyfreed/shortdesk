"use client";

import Link from "next/link";
import { useMarkets } from "@/lib/useMarkets";
import { useNetwork } from "@/lib/network";
import { fmtPct, fmtCompact, annualizedFundingPct } from "@/lib/format";
import type { Market } from "@/lib/hyperliquid";
import { Info } from "@/components/Info";

/**
 * "What's being shorted" — funding rate is the public proxy for crowd
 * positioning (perps always have equal long/short notional, so there is no
 * literal short-count; funding reveals which side is more eager).
 *
 *  - Most NEGATIVE funding  → shorts pay longs → crowd leaning SHORT.
 *  - Most POSITIVE funding  → longs pay shorts → you get PAID to short.
 */
export function ShortRadar({ minVolumeUsd = 1_000_000 }: { minVolumeUsd?: number }) {
  const { network } = useNetwork();
  const { markets, loading } = useMarkets(network);

  // Only consider liquid markets so a dead coin's stale funding doesn't top the list.
  const liquid = markets.filter((m) => m.dayVolumeUsd >= minVolumeUsd);

  const crowdedShorts = [...liquid]
    .sort((a, b) => a.funding - b.funding)
    .slice(0, 6);
  const paidToShort = [...liquid]
    .sort((a, b) => b.funding - a.funding)
    .slice(0, 6);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold">Short radar</h2>
        <Info k="funding" />
        <span className="text-xs text-muted">
          {loading ? "loading…" : "via live funding rates"}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <RadarCard
          title="Crowd is shorting"
          hint="Most negative funding — shorts pay longs, so positioning leans short."
          rows={crowdedShorts}
          tone="short"
        />
        <RadarCard
          title="Paid to short"
          hint="Most positive funding — longs pay shorts, so a short earns funding (carry)."
          rows={paidToShort}
          tone="long"
        />
      </div>
      <p className="mt-2 text-[11px] text-muted">
        Funding rate is a positioning proxy, not a headcount — every perp short
        has a matching long. Shown as an annualized %. Liquid markets only.
      </p>
    </section>
  );
}

function RadarCard({
  title,
  hint,
  rows,
  tone,
}: {
  title: string;
  hint: string;
  rows: Market[];
  tone: "short" | "long";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            tone === "short" ? "bg-short" : "bg-long"
          }`}
        />
        {title}
      </h3>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
      <div className="mt-3 space-y-1">
        {rows.length === 0 && (
          <div className="py-4 text-center text-xs text-muted">
            No data yet.
          </div>
        )}
        {rows.map((m) => {
          const apr = annualizedFundingPct(m.funding);
          return (
            <Link
              key={m.name}
              href={`/trade?coin=${m.name}`}
              className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-surface-2"
            >
              <span className="font-medium">{m.name}</span>
              <span className="flex items-center gap-3 text-xs">
                <span className="text-muted">${fmtCompact(m.dayVolumeUsd)}</span>
                <span
                  className={`tabular w-20 text-right ${
                    apr >= 0 ? "text-long" : "text-short"
                  }`}
                >
                  {fmtPct(apr)}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
