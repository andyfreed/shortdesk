"use client";

import { useMarkets } from "@/lib/useMarkets";
import { useNetwork, NetworkToggle } from "@/lib/network";
import { useBot, type Strategy, type EquityPoint, type ClosedTrade } from "@/lib/bot";
import { fmtUsd, fmtPct } from "@/lib/format";
import Link from "next/link";

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
    desc: "Short coins paying high positive funding — you collect funding each hour just for holding the short.",
  },
];

/** Download the closed-trade log as a CSV file. */
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
  a.download = `shortdesk-bot-trades.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BotView() {
  const { network } = useNetwork();
  const { markets } = useMarkets(network);
  const bot = useBot(markets, network);

  const totalTrades = bot.wins + bot.losses;
  const winRate = totalTrades > 0 ? (bot.wins / totalTrades) * 100 : 0;
  const pnlColor = bot.realized >= 0 ? "text-long" : "text-short";

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
            Scans live markets for overbought coins, opens simulated shorts, and
            closes them on a small take-profit. No real orders are placed.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NetworkToggle />
          <button
            onClick={() => bot.setRunning(!bot.running)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${
              bot.running ? "bg-short" : "bg-long"
            }`}
          >
            {bot.running ? "Stop bot" : "Start bot"}
          </button>
        </div>
      </div>

      <div className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
        This is a learning sandbox. It simulates trades against real prices and
        subtracts real fees — watch whether a “take tiny profits” short strategy
        actually nets out positive here before ever considering real money.
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
        <Stat
          label="Fees paid"
          value={fmtUsd(bot.totalFees)}
          cls="text-short"
        />
        <Stat label="Trades" value={String(totalTrades)} />
        <Stat
          label="Win rate"
          value={totalTrades ? fmtPct(winRate, 0) : "—"}
        />
        <Stat label="Open" value={`${bot.positions.length}/${bot.config.maxConcurrent}`} />
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

          {/* strategy picker */}
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

          {/* fee model */}
          <div className="mb-3">
            <span className="text-[11px] font-medium text-muted">
              Fee model
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
              Maker = passive limit orders (cheaper, but assume they fill).
              Taker = market orders (instant, pricier). Round-trip breakeven on
              a {fmtUsd(bot.config.positionSizeUsd)} trade:{" "}
              <span className="text-warn">{fmtUsd(bot.breakevenUsd)}</span> — your
              take-profit must clear this.
            </p>
          </div>

          {/* coin picker */}
          <div className="mb-3">
            <span className="text-[11px] font-medium text-muted">
              Coins to scan
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
              Comma-separated symbols (e.g. BTC, ETH, SOL). Leave blank to auto-scan
              the top {bot.config.scanCount} markets by volume.
            </p>
          </div>

          <Field
            label="Position size (USD)"
            value={bot.config.positionSizeUsd}
            onChange={(v) => bot.setConfig({ ...bot.config, positionSizeUsd: v })}
            disabled={bot.running}
          />
          <Field
            label="Leverage (x)"
            value={bot.config.leverage}
            onChange={(v) => bot.setConfig({ ...bot.config, leverage: v })}
            disabled={bot.running}
          />
          <Field
            label="Take-profit (net $)"
            step={0.05}
            value={bot.config.takeProfitUsd}
            onChange={(v) => bot.setConfig({ ...bot.config, takeProfitUsd: v })}
            disabled={bot.running}
          />
          <Field
            label="Stop-loss (% move)"
            step={0.1}
            value={bot.config.stopLossPct}
            onChange={(v) => bot.setConfig({ ...bot.config, stopLossPct: v })}
            disabled={bot.running}
          />
          <Field
            label="Max hold (min)"
            value={bot.config.maxHoldMin}
            onChange={(v) => bot.setConfig({ ...bot.config, maxHoldMin: v })}
            disabled={bot.running}
          />
          <Field
            label="Max open positions"
            value={bot.config.maxConcurrent}
            onChange={(v) => bot.setConfig({ ...bot.config, maxConcurrent: v })}
            disabled={bot.running}
          />
          <Field
            label="Entry RSI (overbought)"
            value={bot.config.entryRsi}
            onChange={(v) => bot.setConfig({ ...bot.config, entryRsi: v })}
            disabled={bot.running}
          />
          <Field
            label="Markets to scan"
            value={bot.config.scanCount}
            onChange={(v) => bot.setConfig({ ...bot.config, scanCount: v })}
            disabled={bot.running}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => bot.closeAll()}
              className="flex-1 rounded-md border border-border py-1.5 text-xs hover:border-short hover:text-short"
            >
              Close all
            </button>
            <button
              onClick={() => {
                if (confirm("Reset paper history (trades + P&L)?")) bot.reset();
              }}
              className="flex-1 rounded-md border border-border py-1.5 text-xs hover:border-short hover:text-short"
            >
              Reset
            </button>
          </div>
        </div>

        {/* live + log */}
        <div className="space-y-4">
          {/* open positions */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">
              Open positions ({bot.positions.length})
            </h3>
            {bot.positions.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted">
                {bot.running
                  ? "Waiting for an overbought short signal…"
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

          {/* closed trades */}
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

          {/* activity log */}
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

      <p className="mt-4 text-center text-[11px] text-muted">
        Paper trading only. When you’re ready to test real execution, do it on{" "}
        <Link href="/trade" className="text-accent hover:underline">
          the manual terminal
        </Link>{" "}
        on testnet first.
      </p>
    </div>
  );
}

function EquityChart({
  points,
  start,
}: {
  points: EquityPoint[];
  start: number;
}) {
  if (points.length < 2) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted">
        Equity curve appears once the bot has run a little.
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
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.e).toFixed(1)}`).join(" ");
  const last = points[points.length - 1].e;
  const up = last >= start;
  const startY = y(start);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      {/* start-balance baseline */}
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
      <div className={`tabular font-semibold ${big ? "text-lg" : "text-sm"} ${cls ?? ""}`}>
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  step = 1,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <label className="mb-2 block">
      <span className="text-[11px] text-muted">{label}</span>
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
