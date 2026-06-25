"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMarkets } from "@/lib/useMarkets";
import { useNetwork, NetworkToggle } from "@/lib/network";
import {
  fmtUsd,
  fmtPct,
  fmtCompact,
  annualizedFundingPct,
} from "@/lib/format";
import type { Market } from "@/lib/hyperliquid";
import { Info } from "@/components/Info";

type SortKey = "funding" | "openInterest" | "dayVolumeUsd" | "change24hPct";

export function RadarView() {
  const { network } = useNetwork();
  const { markets, loading } = useMarkets(network);
  const [minVol, setMinVol] = useState(1_000_000);
  const [sort, setSort] = useState<SortKey>("funding");
  const [asc, setAsc] = useState(true); // funding ascending = most-shorted first

  const rows = useMemo(() => {
    const liquid = markets.filter((m) => m.dayVolumeUsd >= minVol);
    return [...liquid].sort((a, b) =>
      asc ? a[sort]! - b[sort]! : b[sort]! - a[sort]!,
    );
  }, [markets, minVol, sort, asc]);

  function toggleSort(k: SortKey) {
    if (sort === k) setAsc((v) => !v);
    else {
      setSort(k);
      // default to most-interesting direction per column
      setAsc(k === "funding");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Short radar <Info k="funding" />
          </h1>
          <p className="text-sm text-muted">
            Crowd positioning by live funding rate.{" "}
            <span className="text-short">Negative</span> = crowd leans short
            (shorts pay longs); <span className="text-long">positive</span> = a
            short earns funding.
          </p>
        </div>
        <NetworkToggle />
      </div>

      <div className="mb-3 flex items-center gap-2 text-xs text-muted">
        <span>Min 24h volume:</span>
        {[0, 1_000_000, 10_000_000, 50_000_000].map((v) => (
          <button
            key={v}
            onClick={() => setMinVol(v)}
            className={`rounded-md border px-2 py-1 ${
              minVol === v
                ? "border-accent text-accent"
                : "border-border text-muted"
            }`}
          >
            {v === 0 ? "All" : `$${fmtCompact(v)}`}
          </button>
        ))}
        <span className="ml-auto">
          {loading ? "loading…" : `${rows.length} markets`}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Market</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <Th onClick={() => toggleSort("change24hPct")}>24h</Th>
              <Th onClick={() => toggleSort("funding")}>Funding (APR)</Th>
              <Th onClick={() => toggleSort("openInterest")}>Open Interest</Th>
              <Th onClick={() => toggleSort("dayVolumeUsd")}>24h Vol</Th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <Row key={m.name} m={m} />
            ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted">
                  No markets above this volume.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        Funding is a positioning proxy, not a headcount — every perp short has a
        matching long. Open interest is the total USD value of open positions in
        that market. Higher OI + very negative funding = a crowded short that
        can be prone to short squeezes.
      </p>
    </div>
  );
}

function Th({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className="cursor-pointer select-none px-3 py-2 text-right font-medium hover:text-foreground"
    >
      {children}
    </th>
  );
}

function Row({ m }: { m: Market }) {
  const apr = annualizedFundingPct(m.funding);
  const up = (m.change24hPct ?? 0) >= 0;
  return (
    <tr className="border-t border-border hover:bg-surface/60">
      <td className="px-3 py-2.5 font-medium">{m.name}</td>
      <td className="px-3 py-2.5 text-right tabular">{fmtUsd(m.markPx)}</td>
      <td
        className={`px-3 py-2.5 text-right tabular ${
          up ? "text-long" : "text-short"
        }`}
      >
        {fmtPct(m.change24hPct)}
      </td>
      <td
        className={`px-3 py-2.5 text-right tabular font-medium ${
          apr >= 0 ? "text-long" : "text-short"
        }`}
      >
        {fmtPct(apr)}
      </td>
      <td className="px-3 py-2.5 text-right tabular text-muted">
        ${fmtCompact(m.openInterest)}
      </td>
      <td className="px-3 py-2.5 text-right tabular text-muted">
        ${fmtCompact(m.dayVolumeUsd)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <Link
          href={`/trade?coin=${m.name}`}
          className="rounded-md bg-short/15 px-2.5 py-1 text-xs font-medium text-short hover:bg-short/25"
        >
          Short
        </Link>
      </td>
    </tr>
  );
}
