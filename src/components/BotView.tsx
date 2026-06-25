"use client";

import { useMarkets } from "@/lib/useMarkets";
import { useNetwork, NetworkToggle } from "@/lib/network";
import { useBot } from "@/lib/bot";
import { fmtUsd, fmtPct } from "@/lib/format";
import Link from "next/link";

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

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* config */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-2 text-sm font-semibold">Strategy settings</h3>
          <p className="mb-3 text-[11px] text-muted">
            Shorts the most overbought liquid market (RSI 5m ≥ threshold), then
            closes at the take-profit, stop, or timeout — whichever hits first.
          </p>
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
                      entry {fmtUsd(p.entryPrice)} · RSI {p.rsi.toFixed(0)}
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
            <h3 className="mb-2 text-sm font-semibold">
              Trade history ({bot.closed.length})
            </h3>
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
