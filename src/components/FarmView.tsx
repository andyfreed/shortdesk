"use client";

import { useNetwork } from "@/lib/network";
import { useFundingFarm } from "@/lib/farm";
import type { Market } from "@/lib/hyperliquid";
import { fmtUsd, fmtPct } from "@/lib/format";
import { EquityChart } from "@/components/EquityChart";
import { Tip } from "@/components/Info";

export function FarmView({ markets }: { markets: Market[] }) {
  const { network } = useNetwork();
  const farm = useFundingFarm(markets, network);
  const c = farm.config;

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Delta-neutral: short a high-funding perp <strong>and</strong> hold an
          equal long, so price moves cancel and you just collect funding. The
          one strategy here with a real structural edge — but watch fees.
        </p>
        <button
          onClick={() => farm.setRunning(!farm.running)}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-white ${
            farm.running ? "bg-short" : "bg-long"
          }`}
        >
          {farm.running ? "Stop farm" : "Start farm"}
        </button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Paper equity" value={fmtUsd(farm.equity)} big />
        <Stat
          label="Net P&L"
          value={`${farm.realized + farm.unrealized >= 0 ? "+" : ""}${fmtUsd(
            farm.realized + farm.unrealized,
          )}`}
          cls={farm.realized + farm.unrealized >= 0 ? "text-long" : "text-short"}
          big
        />
        <Stat
          label="Funding collected"
          value={fmtUsd(farm.totalFunding)}
          cls="text-long"
        />
        <Stat label="Fees paid" value={fmtUsd(farm.totalFees)} cls="text-short" />
      </div>

      {/* equity curve */}
      <div className="mt-3 rounded-xl border border-border bg-surface p-4">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Equity curve</h3>
          <span className="text-[11px] text-muted">
            dashed = starting {fmtUsd(c.startBalance)} · funding minus fees
          </span>
        </div>
        <EquityChart points={farm.equityCurve} start={c.startBalance} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* settings */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Farm settings</h3>

          <div className="mb-3">
            <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
              Fee model
              <Tip
                title="Fee model"
                text="Maker = passive limit orders (~0.015%, assumes they fill). Taker = market orders (~0.045%). The farm pays fees on all four fills (open + close, two legs), so cheaper fees matter a lot here."
              />
            </span>
            <div className="mt-1 inline-flex rounded-md border border-border p-0.5 text-xs">
              {(
                [
                  ["maker", "Maker"],
                  ["taker", "Taker"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  disabled={farm.running}
                  onClick={() => farm.setConfig({ ...c, feeModel: v })}
                  className={`rounded px-2.5 py-1 disabled:opacity-50 ${
                    c.feeModel === v ? "bg-surface-2 text-foreground" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Field
            label="Size per leg (USD)"
            tip="USD size of EACH leg of the market-neutral pair — you short this much perp AND long this much offsetting. Funding is earned on this notional."
            value={c.perPositionUsd}
            onChange={(v) => farm.setConfig({ ...c, perPositionUsd: v })}
            disabled={farm.running}
          />
          <Field
            label="Max positions"
            tip="How many different funding-paying coins to farm at once. More = your capital is spread across more funding sources."
            value={c.maxPositions}
            onChange={(v) => farm.setConfig({ ...c, maxPositions: v })}
            disabled={farm.running}
          />
          <Field
            label="Min entry funding (APR %)"
            tip="Only open a new position if the coin's annualized funding is at least this high. Higher = pickier; you wait for juicier funding."
            value={c.minEntryApr}
            onChange={(v) => farm.setConfig({ ...c, minEntryApr: v })}
            disabled={farm.running}
          />
          <Field
            label="Exit funding (APR %)"
            tip="Close a position once its funding falls below this (or goes negative). Funding decays over time, so this rotates capital out of fading trades."
            value={c.exitApr}
            onChange={(v) => farm.setConfig({ ...c, exitApr: v })}
            disabled={farm.running}
          />
          <Field
            label="Min 24h volume (USD)"
            tip="Skip markets trading less than this in 24h. Thin markets have unreliable funding and worse fills."
            value={c.minVolumeUsd}
            step={1_000_000}
            onChange={(v) => farm.setConfig({ ...c, minVolumeUsd: v })}
            disabled={farm.running}
          />
          <Field
            label="Starting balance (USD)"
            tip="Simulated starting paper capital. Equity = this + realized + unrealized."
            value={c.startBalance}
            step={100}
            onChange={(v) => farm.setConfig({ ...c, startBalance: v })}
            disabled={farm.running}
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => farm.closeAll()}
              className="flex-1 rounded-md border border-border py-1.5 text-xs hover:border-short hover:text-short"
            >
              Close all
            </button>
            <button
              onClick={() => {
                if (confirm("Reset farm history?")) farm.reset();
              }}
              className="flex-1 rounded-md border border-border py-1.5 text-xs hover:border-short hover:text-short"
            >
              Reset
            </button>
          </div>
        </div>

        {/* positions + log */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">
              Open positions ({farm.positions.length})
            </h3>
            {farm.positions.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted">
                {farm.running
                  ? "Waiting for a market paying ≥ your min funding…"
                  : "Start the farm to begin collecting funding."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="px-1 py-1 text-left font-medium">Coin</th>
                      <th className="px-1 py-1 text-right font-medium">Entry APR</th>
                      <th className="px-1 py-1 text-right font-medium">Now APR</th>
                      <th className="px-1 py-1 text-right font-medium">Funding</th>
                      <th className="px-1 py-1 text-right font-medium">Age</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farm.positions.map((p) => {
                      // lastAccrueAt is refreshed every tick — use it as "now"
                      // so this stays pure (no Date.now() during render).
                      const ageH = (p.lastAccrueAt - p.openedAt) / 3_600_000;
                      const beH = farm.breakevenHoursAt(p.currentApr);
                      const profitable = p.accruedFunding >= p.openFees * 2;
                      return (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-1 py-1 font-medium">{p.coin}</td>
                          <td className="px-1 py-1 text-right tabular text-muted">
                            {fmtPct(p.entryApr, 0)}
                          </td>
                          <td
                            className={`px-1 py-1 text-right tabular ${
                              p.currentApr >= p.entryApr ? "text-long" : "text-muted"
                            }`}
                          >
                            {fmtPct(p.currentApr, 0)}
                          </td>
                          <td
                            className={`px-1 py-1 text-right tabular ${
                              profitable ? "text-long" : ""
                            }`}
                          >
                            +${p.accruedFunding.toFixed(3)}
                          </td>
                          <td
                            className="px-1 py-1 text-right tabular text-muted"
                            title={`Breakeven on fees ≈ ${beH.toFixed(1)}h`}
                          >
                            {ageH < 1
                              ? `${Math.round(ageH * 60)}m`
                              : `${ageH.toFixed(1)}h`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">
              Closed ({farm.closed.length})
            </h3>
            {farm.closed.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted">Nothing closed yet.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted">
                    <tr>
                      <th className="px-1 py-1 text-left font-medium">Coin</th>
                      <th className="px-1 py-1 text-right font-medium">Held</th>
                      <th className="px-1 py-1 text-right font-medium">Funding</th>
                      <th className="px-1 py-1 text-right font-medium">Fees</th>
                      <th className="px-1 py-1 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farm.closed.map((t) => (
                      <tr key={t.id + t.closedAt} className="border-t border-border">
                        <td className="px-1 py-1 font-medium">{t.coin}</td>
                        <td className="px-1 py-1 text-right tabular text-muted">
                          {t.hoursHeld < 1
                            ? `${Math.round(t.hoursHeld * 60)}m`
                            : `${t.hoursHeld.toFixed(1)}h`}
                        </td>
                        <td className="px-1 py-1 text-right tabular text-long">
                          +${t.fundingCollected.toFixed(3)}
                        </td>
                        <td className="px-1 py-1 text-right tabular text-short">
                          ${t.fees.toFixed(3)}
                        </td>
                        <td
                          className={`px-1 py-1 text-right tabular ${
                            t.net >= 0 ? "text-long" : "text-short"
                          }`}
                        >
                          {t.net >= 0 ? "+" : ""}
                          {t.net.toFixed(3)}
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
              {farm.log.length === 0 ? (
                <p className="text-center">—</p>
              ) : (
                farm.log.map((l, i) => (
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
