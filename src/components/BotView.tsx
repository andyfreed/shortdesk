"use client";

import { useState } from "react";
import Link from "next/link";
import { useMarkets } from "@/lib/useMarkets";
import { useBot, type Strategy, type ClosedTrade } from "@/lib/bot";
import type { Market, Network } from "@/lib/hyperliquid";

// The bot is always paper, so it always reads LIVE MAINNET data (testnet
// markets are thin with fake funding → useless signals). No network toggle here.
const BOT_NETWORK: Network = "mainnet";
import { fmtUsd, fmtPct } from "@/lib/format";
import { EquityChart } from "@/components/EquityChart";
import { FarmView } from "@/components/FarmView";
import { AllSims } from "@/components/AllSims";
import { RunnerControl } from "@/components/RunnerControl";
import { Tip } from "@/components/Info";

const STRATEGIES: { key: Strategy; label: string; desc: string }[] = [
  {
    key: "meanReversion",
    label: "Mean reversion",
    desc: "Short the most overbought coin (high RSI), betting an over-extended pump snaps back down.",
  },
  {
    key: "momentum",
    label: "Momentum (downtrend)",
    desc: "Short coins already falling over the last hour, betting the down-move continues.",
  },
  {
    key: "fundingCarry",
    label: "Funding carry",
    desc: "Short coins paying high positive funding — collect funding each hour just for holding the short.",
  },
  {
    key: "experiment",
    label: "🧪 Relative-strength fade (experimental)",
    desc: "An untested idea: short the alt that has run furthest AHEAD of BTC this hour, betting the excess move reverts. Paper only.",
  },
];

const STRAT_LABEL: Record<Strategy, string> = Object.fromEntries(
  STRATEGIES.map((s) => [s.key, s.label]),
) as Record<Strategy, string>;

export function BotView() {
  const { markets } = useMarkets(BOT_NETWORK);
  const [mode, setMode] = useState<
    "single" | "compare" | "farm" | "all" | "runner"
  >("single");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            Short bot
            <span className="rounded-md bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent">
              PAPER · simulated
            </span>
          </h1>
          <p className="text-sm text-muted">
            Scans live markets for short signals and simulates trades net of
            fees. No real orders are placed.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-lg border border-border p-0.5 text-xs">
            {(
              [
                ["single", "Single bot"],
                ["compare", "Compare"],
                ["farm", "Funding farm"],
                ["all", "All (race)"],
                ["runner", "24/7"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                className={`shrink-0 rounded-md px-2.5 py-1 ${
                  mode === v ? "bg-surface-2 text-foreground" : "text-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <span
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted"
            title="The paper bot always uses live mainnet market data for realistic signals. There's no real money at stake, so no testnet option."
          >
            Live mainnet data
          </span>
        </div>
      </div>

      <div className="mb-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
        Learning sandbox. It simulates trades against real prices and subtracts
        real fees + funding — watch whether any of these actually net out
        positive here before considering real money.
      </div>

      <div
        className={`mb-4 rounded-lg border px-3 py-2 text-xs ${
          mode === "runner"
            ? "border-long/40 bg-long/10 text-foreground"
            : "border-border bg-surface text-muted"
        }`}
      >
        {mode === "runner" ? (
          <>
            <strong className="text-long">Runs 24/7 on your server.</strong>{" "}
            This is the only mode that keeps going with your browser closed (it
            lives on the host you connected, not this page).
          </>
        ) : (
          <>
            <strong>Runs in this browser tab only.</strong> This sim runs while
            you’re on this tab; it pauses if you leave and resumes when you come
            back. For always-on (browser closed), use the{" "}
            <button
              onClick={() => setMode("runner")}
              className="text-accent underline"
            >
              24/7
            </button>{" "}
            tab.
          </>
        )}
      </div>

      {mode === "single" ? (
        <SingleBot markets={markets} network={BOT_NETWORK} />
      ) : mode === "compare" ? (
        <CompareBots markets={markets} network={BOT_NETWORK} />
      ) : mode === "farm" ? (
        <FarmView markets={markets} network={BOT_NETWORK} />
      ) : mode === "all" ? (
        <AllSims markets={markets} network={BOT_NETWORK} />
      ) : (
        <RunnerControl />
      )}

      <p className="mt-4 text-center text-[11px] text-muted">
        Paper trading only. To test real execution, use{" "}
        <Link href="/trade" className="text-accent hover:underline">
          the manual terminal
        </Link>{" "}
        on testnet first.
      </p>
    </div>
  );
}

/* ----------------------------- single bot ----------------------------- */

function SingleBot({
  markets,
  network,
}: {
  markets: Market[];
  network: Network;
}) {
  const bot = useBot(markets, network);

  const totalTrades = bot.wins + bot.losses;
  const winRate = totalTrades > 0 ? (bot.wins / totalTrades) * 100 : 0;
  const pnlColor = bot.realized >= 0 ? "text-long" : "text-short";

  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          onClick={() => bot.setRunning(!bot.running)}
          className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
            bot.running ? "bg-short" : "bg-long"
          }`}
        >
          {bot.running ? "Stop bot" : "Start bot"}
        </button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Paper equity" value={fmtUsd(bot.equity)} big />
        <Stat
          label="Realized P&L"
          value={`${bot.realized >= 0 ? "+" : ""}${fmtUsd(bot.realized)}`}
          cls={pnlColor}
          big
        />
        <Stat
          label="Unrealized"
          value={`${bot.unrealized >= 0 ? "+" : ""}${fmtUsd(bot.unrealized)}`}
          cls={bot.unrealized >= 0 ? "text-long" : "text-short"}
        />
        <Stat label="Fees paid" value={fmtUsd(bot.totalFees)} cls="text-short" />
        <Stat label="Trades" value={String(totalTrades)} />
        <Stat label="Win rate" value={totalTrades ? fmtPct(winRate, 0) : "—"} />
        <Stat
          label="Open"
          value={`${bot.positions.length}/${bot.config.maxConcurrent}`}
        />
        <Stat
          label="Status"
          value={bot.running ? (bot.scanning ? "scanning…" : "running") : "stopped"}
          cls={bot.running ? "text-long" : "text-muted"}
        />
      </div>

      {/* equity curve */}
      <div className="mt-3 rounded-xl border border-border bg-surface p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Equity curve</h3>
          <span className="text-[11px] text-muted">
            dashed line = starting {fmtUsd(bot.config.startBalance)}
          </span>
        </div>
        <EquityChart points={bot.equityCurve} start={bot.config.startBalance} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* config */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">Strategy settings</h3>

          <div className="mb-3">
            <span className="text-[11px] font-medium text-muted">Strategy</span>
            <div className="mt-1 flex flex-col gap-1">
              {STRATEGIES.map((s) => (
                <button
                  key={s.key}
                  disabled={bot.running}
                  onClick={() => bot.setConfig({ ...bot.config, strategy: s.key })}
                  className={`rounded-md border px-2 py-1.5 text-left text-xs disabled:opacity-50 ${
                    bot.config.strategy === s.key
                      ? "border-accent text-foreground"
                      : "border-border text-muted"
                  }`}
                >
                  <span className="font-medium">{s.label}</span>
                  <span className="block text-[10px] text-muted">{s.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
              Fee model
              <Tip
                title="Fee model"
                text="The exchange fee charged on every fill. Maker = passive limit orders (~0.015%, cheaper, but assumes they actually fill). Taker = market orders (~0.045%, instant). You pay it on BOTH the open and the close, so it's the main thing eating a tiny-profit strategy."
              />
            </span>
            <div className="mt-1 inline-flex rounded-md border border-border p-0.5 text-xs">
              {(
                [
                  ["maker", "Maker ~0.015%"],
                  ["taker", "Taker ~0.045%"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  disabled={bot.running}
                  onClick={() => bot.setConfig({ ...bot.config, feeModel: v })}
                  className={`rounded px-2 py-1 disabled:opacity-50 ${
                    bot.config.feeModel === v
                      ? "bg-surface-2 text-foreground"
                      : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-muted">
              Maker = passive limit orders (cheaper, assume they fill). Taker =
              market orders. Round-trip breakeven on{" "}
              {fmtUsd(bot.config.positionSizeUsd)}:{" "}
              <span className="text-warn">{fmtUsd(bot.breakevenUsd)}</span> — your
              take-profit must clear this.
            </p>
          </div>

          <div className="mb-3">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
              Coins to scan
              <Tip
                title="Coins to scan"
                text="Which markets the bot looks at for signals. Type specific symbols (comma-separated) to focus it, or leave blank to auto-scan the most liquid markets by volume."
              />
            </span>
            <input
              disabled={bot.running}
              value={bot.config.coins.join(", ")}
              onChange={(e) =>
                bot.setConfig({
                  ...bot.config,
                  coins: e.target.value
                    .split(",")
                    .map((c) => c.trim().toUpperCase())
                    .filter(Boolean),
                })
              }
              placeholder="blank = auto (top liquid)"
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
            />
            <p className="mt-1 text-[10px] text-muted">
              Comma-separated (e.g. BTC, ETH, SOL). Blank = auto top{" "}
              {bot.config.scanCount} by volume.
            </p>
          </div>

          <Field
            label="Position size (USD)"
            tip="The dollar size of each simulated short (its notional). Bigger size = bigger $ swings and bigger fees per trade."
            value={bot.config.positionSizeUsd}
            onChange={(v) => bot.setConfig({ ...bot.config, positionSizeUsd: v })}
            disabled={bot.running}
          />
          <Field
            label="Leverage (x)"
            tip="Multiplier on the position. It mainly sets the simulated liquidation price here (entry × (1 + 1/leverage)). Higher = liquidation closer to entry = a small adverse move wipes the position."
            value={bot.config.leverage}
            onChange={(v) => bot.setConfig({ ...bot.config, leverage: v })}
            disabled={bot.running}
          />
          <Field
            label="Take-profit (net $)"
            tip="Close the position once its profit AFTER fees and funding reaches this many dollars. e.g. 0.50 = bank it at +$0.50 net. Set it above the fee breakeven shown above or you can't win."
            step={0.05}
            value={bot.config.takeProfitUsd}
            onChange={(v) => bot.setConfig({ ...bot.config, takeProfitUsd: v })}
            disabled={bot.running}
          />
          <Field
            label="Stop-loss (% move)"
            tip="Close at a loss if the price moves this % against the short (i.e. rises this much above entry). Caps the downside so one bad trade doesn't erase many small wins."
            step={0.1}
            value={bot.config.stopLossPct}
            onChange={(v) => bot.setConfig({ ...bot.config, stopLossPct: v })}
            disabled={bot.running}
          />
          <Field
            label="Max hold (min)"
            tip="Force-close a position after this many minutes even if neither the take-profit nor stop has hit — so capital doesn't sit stuck in a position going nowhere."
            value={bot.config.maxHoldMin}
            onChange={(v) => bot.setConfig({ ...bot.config, maxHoldMin: v })}
            disabled={bot.running}
          />
          <Field
            label="Max open positions"
            tip="How many shorts the bot will hold at the same time. More = more diversified but more total risk and fees."
            value={bot.config.maxConcurrent}
            onChange={(v) => bot.setConfig({ ...bot.config, maxConcurrent: v })}
            disabled={bot.running}
          />
          {bot.config.strategy === "meanReversion" && (
            <Field
              label="Entry RSI (overbought)"
              tip="RSI is a 0–100 momentum gauge; above ~70 means 'overbought' (price ran up fast). The bot shorts coins at/above this RSI, betting the pump cools off. Higher = pickier."
              value={bot.config.entryRsi}
              onChange={(v) => bot.setConfig({ ...bot.config, entryRsi: v })}
              disabled={bot.running}
            />
          )}
          {bot.config.strategy === "fundingCarry" && (
            <Field
              label="Min funding (APR %)"
              tip="Only short coins whose annualized funding rate is at least this high — i.e. where longs are paying shorts well, so you collect funding while holding the short."
              value={bot.config.minFundingApr}
              onChange={(v) => bot.setConfig({ ...bot.config, minFundingApr: v })}
              disabled={bot.running}
            />
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => bot.closeAll()}
              className="flex-1 rounded-md border border-border py-1.5 text-xs hover:border-short hover:text-short"
            >
              Close all
            </button>
            <button
              onClick={() => {
                if (confirm("Reset paper history?")) bot.reset();
              }}
              className="flex-1 rounded-md border border-border py-1.5 text-xs hover:border-short hover:text-short"
            >
              Reset
            </button>
          </div>
        </div>

        {/* live + log */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">
              Open positions ({bot.positions.length})
            </h3>
            {bot.positions.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted">
                {bot.running
                  ? "Waiting for a signal…"
                  : "Start the bot to begin scanning."}
              </p>
            ) : (
              <div className="space-y-1 text-xs">
                {bot.positions.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5"
                  >
                    <span className="font-medium text-short">{p.coin}</span>
                    <span className="tabular text-muted">
                      entry {fmtUsd(p.entryPrice)} · {p.signal}
                    </span>
                    <span className="tabular text-muted">
                      liq {fmtUsd(p.liqPrice)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Trade history ({bot.closed.length})
              </h3>
              {bot.closed.length > 0 && (
                <button
                  onClick={() => exportCsv(bot.closed)}
                  className="rounded-md border border-border px-2 py-1 text-[11px] text-muted hover:text-foreground"
                >
                  Export CSV
                </button>
              )}
            </div>
            {bot.closed.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted">No trades yet.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="px-1 py-1 text-left font-medium">Coin</th>
                      <th className="px-1 py-1 text-right font-medium">Entry</th>
                      <th className="px-1 py-1 text-right font-medium">Exit</th>
                      <th className="px-1 py-1 text-right font-medium">Net</th>
                      <th className="px-1 py-1 text-right font-medium">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bot.closed.map((c) => (
                      <tr key={c.id + c.closedAt} className="border-t border-border">
                        <td className="px-1 py-1 font-medium">{c.coin}</td>
                        <td className="px-1 py-1 text-right tabular">
                          {fmtUsd(c.entryPrice)}
                        </td>
                        <td className="px-1 py-1 text-right tabular">
                          {fmtUsd(c.exitPrice)}
                        </td>
                        <td
                          className={`px-1 py-1 text-right tabular ${
                            c.net >= 0 ? "text-long" : "text-short"
                          }`}
                        >
                          {c.net >= 0 ? "+" : ""}
                          {c.net.toFixed(3)}
                        </td>
                        <td className="px-1 py-1 text-right text-muted">
                          {c.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">Activity</h3>
            <div className="max-h-40 space-y-0.5 overflow-y-auto font-mono text-[11px] text-muted">
              {bot.log.length === 0 ? (
                <p className="text-center">—</p>
              ) : (
                bot.log.map((l, i) => (
                  <div key={i}>
                    <span className="text-foreground/40">
                      {new Date(l.t).toLocaleTimeString()}
                    </span>{" "}
                    {l.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* --------------------------- comparison mode --------------------------- */

function CompareBots({
  markets,
  network,
}: {
  markets: Market[];
  network: Network;
}) {
  // Four independent paper accounts, one per strategy, each with its own store.
  const bots = {
    meanReversion: useBot(markets, network, {
      storageKey: "shortdesk.bot.cmp.meanReversion",
      lockedStrategy: "meanReversion",
    }),
    momentum: useBot(markets, network, {
      storageKey: "shortdesk.bot.cmp.momentum",
      lockedStrategy: "momentum",
    }),
    fundingCarry: useBot(markets, network, {
      storageKey: "shortdesk.bot.cmp.fundingCarry",
      lockedStrategy: "fundingCarry",
    }),
    experiment: useBot(markets, network, {
      storageKey: "shortdesk.bot.cmp.experiment",
      lockedStrategy: "experiment",
    }),
  };
  const list = Object.values(bots);
  const anyRunning = list.some((b) => b.running);
  const bestRealized = Math.max(...list.map((b) => b.realized));

  function setAll(run: boolean) {
    list.forEach((b) => b.setRunning(run));
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Four strategies, four separate paper accounts, same live data — running
          head-to-head. Same default settings (maker fees, {fmtUsd(100)}/trade).
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setAll(!anyRunning)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              anyRunning ? "bg-short" : "bg-long"
            }`}
          >
            {anyRunning ? "Stop all" : "Start all"}
          </button>
          <button
            onClick={() => {
              if (confirm("Reset all comparison accounts?"))
                list.forEach((b) => b.reset());
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(bots) as Strategy[]).map((key) => (
          <CompareCard
            key={key}
            strat={key}
            bot={bots[key as keyof typeof bots]}
            leading={
              bots[key as keyof typeof bots].realized === bestRealized &&
              bestRealized !== 0
            }
          />
        ))}
      </div>
    </>
  );
}

function CompareCard({
  strat,
  bot,
  leading,
}: {
  strat: Strategy;
  bot: ReturnType<typeof useBot>;
  leading: boolean;
}) {
  const trades = bot.wins + bot.losses;
  const winRate = trades ? (bot.wins / trades) * 100 : 0;
  return (
    <div
      className={`rounded-xl border bg-surface p-4 ${
        leading ? "border-long/60" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{STRAT_LABEL[strat]}</h3>
        {leading && (
          <span className="rounded bg-long/20 px-1.5 py-0.5 text-[10px] font-medium text-long">
            leading
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <div className="text-[11px] text-muted">Realized P&L</div>
          <div
            className={`tabular text-xl font-semibold ${
              bot.realized >= 0 ? "text-long" : "text-short"
            }`}
          >
            {bot.realized >= 0 ? "+" : ""}
            {fmtUsd(bot.realized)}
          </div>
        </div>
        <div className="text-right text-[11px] text-muted">
          <div>{trades} trades · {trades ? fmtPct(winRate, 0) : "—"} win</div>
          <div>fees {fmtUsd(bot.totalFees)}</div>
          <div>{bot.positions.length} open</div>
        </div>
      </div>
      <div className="mt-2">
        <EquityChart points={bot.equityCurve} start={bot.config.startBalance} />
      </div>
    </div>
  );
}

/* ------------------------------ helpers ------------------------------ */

function exportCsv(closed: ClosedTrade[]) {
  const headers = [
    "coin",
    "entry",
    "exit",
    "sizeUsd",
    "grossPnl",
    "fees",
    "funding",
    "net",
    "reason",
    "openedAt",
    "closedAt",
  ];
  const rows = closed.map((c) =>
    [
      c.coin,
      c.entryPrice,
      c.exitPrice,
      c.sizeUsd,
      c.grossPnl.toFixed(4),
      c.fees.toFixed(4),
      c.funding.toFixed(4),
      c.net.toFixed(4),
      c.reason,
      new Date(c.openedAt).toISOString(),
      new Date(c.closedAt).toISOString(),
    ].join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "shortdesk-bot-trades.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Stat({
  label,
  value,
  cls,
  big,
}: {
  label: string;
  value: string;
  cls?: string;
  big?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className={`tabular font-semibold ${big ? "text-lg" : "text-sm"} ${cls ?? ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  tip,
  value,
  onChange,
  step = 1,
  disabled,
}: {
  label: string;
  tip?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="mb-2 block">
      <span className="flex items-center gap-1 text-[11px] text-muted">
        {label}
        {tip && <Tip title={label} text={tip} />}
      </span>
      <input
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent disabled:opacity-50"
      />
    </label>
  );
}
