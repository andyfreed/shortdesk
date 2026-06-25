"use client";

import { useBot, type EquityPoint } from "@/lib/bot";
import { useFundingFarm } from "@/lib/farm";
import type { Market, Network } from "@/lib/hyperliquid";
import { fmtUsd, fmtPct } from "@/lib/format";
import { EquityChart } from "@/components/EquityChart";

/**
 * Mounts every paper sim at once so they run and race head-to-head on one
 * screen: the single bot, the four comparison strategies, and the funding
 * farm. Each keeps its own persisted account, so this shares state with the
 * other bot modes.
 */
export function AllSims({
  markets,
  network,
}: {
  markets: Market[];
  network: Network;
}) {
  const single = useBot(markets, network);
  const meanRev = useBot(markets, network, {
    storageKey: "shortdesk.bot.cmp.meanReversion",
    lockedStrategy: "meanReversion",
  });
  const momentum = useBot(markets, network, {
    storageKey: "shortdesk.bot.cmp.momentum",
    lockedStrategy: "momentum",
  });
  const carry = useBot(markets, network, {
    storageKey: "shortdesk.bot.cmp.fundingCarry",
    lockedStrategy: "fundingCarry",
  });
  const experiment = useBot(markets, network, {
    storageKey: "shortdesk.bot.cmp.experiment",
    lockedStrategy: "experiment",
  });
  const farm = useFundingFarm(markets, network);

  const cards = [
    card("Single bot", single),
    card("Mean reversion", meanRev),
    card("Momentum", momentum),
    card("Funding carry", carry),
    card("🧪 Rel-strength fade", experiment),
    card("🌾 Funding farm", farm),
  ];

  const toggles = [single, meanRev, momentum, carry, experiment, farm];
  const anyRunning = toggles.some((t) => t.running);
  const bestNet = Math.max(...cards.map((c) => c.net));

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Every paper sim running at once on the same live data. Net P&L =
          realized + unrealized, after fees + funding. Best performer is
          highlighted.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => toggles.forEach((t) => t.setRunning(!anyRunning))}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              anyRunning ? "bg-short" : "bg-long"
            }`}
          >
            {anyRunning ? "Stop all" : "Start all"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.name}
            className={`rounded-xl border bg-surface p-4 ${
              c.net === bestNet && bestNet !== 0
                ? "border-long/60"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{c.name}</h3>
              <span
                className={`h-2 w-2 rounded-full ${
                  c.running ? "bg-long" : "bg-muted"
                }`}
                title={c.running ? "running" : "stopped"}
              />
            </div>
            <div className="mt-1 flex items-end justify-between">
              <div
                className={`tabular text-xl font-semibold ${
                  c.net >= 0 ? "text-long" : "text-short"
                }`}
              >
                {c.net >= 0 ? "+" : ""}
                {fmtUsd(c.net)}
              </div>
              <div className="text-right text-[11px] text-muted">
                <div>{fmtUsd(c.equity)} equity</div>
                <div>
                  {c.trades} trades
                  {c.winRate != null && ` · ${fmtPct(c.winRate, 0)}`}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <EquityChart points={c.curve} start={c.start} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

interface CardData {
  name: string;
  net: number;
  equity: number;
  trades: number;
  winRate: number | null;
  running: boolean;
  curve: EquityPoint[];
  start: number;
}

function card(
  name: string,
  sim: ReturnType<typeof useBot> | ReturnType<typeof useFundingFarm>,
): CardData {
  const isBot = "wins" in sim;
  const trades = isBot ? sim.wins + sim.losses : sim.closed.length;
  const winRate =
    isBot && trades > 0 ? (sim.wins / trades) * 100 : null;
  return {
    name,
    net: sim.realized + sim.unrealized,
    equity: sim.equity,
    trades,
    winRate,
    running: sim.running,
    curve: sim.equityCurve,
    start: sim.config.startBalance,
  };
}
