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

type SortKey = "name" | "markPx" | "change24hPct" | "funding" | "dayVolumeUsd";

export function MarketsDashboard() {
  const { network } = useNetwork();
  const { markets, loading, error } = useMarkets(network);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("dayVolumeUsd");
  const [asc, setAsc] = useState(false);

  const rows = useMemo(() => {
    const filtered = markets.filter((m) =>
      m.name.toLowerCase().includes(query.toLowerCase()),
    );
    const sorted = [...filtered].sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === "string" && typeof bv === "string")
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      const an = (av as number) ?? 0;
      const bn = (bv as number) ?? 0;
      return asc ? an - bn : bn - an;
    });
    return sorted;
  }, [markets, query, sort, asc]);

  function toggleSort(k: SortKey) {
    if (sort === k) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(false);
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Markets</h2>
          <span className="text-xs text-muted">
            {loading ? "loading…" : `${rows.length} perps · live`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search e.g. BTC"
            className="w-32 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm outline-none focus:border-accent sm:w-44"
          />
          <NetworkToggle />
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-short/40 bg-short/10 px-3 py-2 text-sm text-short">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface text-xs text-muted">
            <tr>
              <Th onClick={() => toggleSort("name")}>Market</Th>
              <Th onClick={() => toggleSort("markPx")} right>
                Price
              </Th>
              <Th onClick={() => toggleSort("change24hPct")} right>
                24h
              </Th>
              <Th onClick={() => toggleSort("funding")} right>
                <span className="inline-flex items-center justify-end gap-1">
                  Funding (APR) <Info k="funding" />
                </span>
              </Th>
              <Th onClick={() => toggleSort("dayVolumeUsd")} right>
                24h Vol
              </Th>
              <th className="px-3 py-2 text-right font-medium">Max Lev</th>
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
                  No markets match “{query}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  children,
  onClick,
  right,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  right?: boolean;
}) {
  return (
    <th
      onClick={onClick}
      className={`cursor-pointer select-none px-3 py-2 font-medium hover:text-foreground ${
        right ? "text-right" : "text-left"
      }`}
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
        className={`px-3 py-2.5 text-right tabular ${
          apr >= 0 ? "text-long" : "text-short"
        }`}
        title="Positive funding means shorts get paid"
      >
        {fmtPct(apr)}
      </td>
      <td className="px-3 py-2.5 text-right tabular text-muted">
        ${fmtCompact(m.dayVolumeUsd)}
      </td>
      <td className="px-3 py-2.5 text-right tabular text-muted">
        {m.maxLeverage}x
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
