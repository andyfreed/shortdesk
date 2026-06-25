"use client";

import { useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet";
import { useNetwork, NetworkToggle } from "@/lib/network";
import { useAccountState } from "@/lib/useAccount";
import { useMarkets } from "@/lib/useMarkets";
import {
  closeShort,
  type Market,
  type OpenPosition,
} from "@/lib/hyperliquid";
import { positionPnl, DEFAULT_TAKER_FEE } from "@/lib/calc";
import { fmtUsd, fmtPct, fmtNum, annualizedFundingPct } from "@/lib/format";
import { WalletPanel } from "@/components/WalletPanel";
import { Info } from "@/components/Info";

export function PositionsView() {
  const w = useWallet();
  const { network } = useNetwork();
  const { markets } = useMarkets(network);
  const { account, stale, refresh } = useAccountState(network, w.address);

  const positions = account?.positions ?? [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Your positions</h1>
          <p className="text-sm text-muted">
            What each open trade is worth now, and what happens if the price
            moves.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <NetworkToggle />
          <Link
            href="/trade"
            className="rounded-lg bg-short px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
          >
            New short
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:[grid-template-areas:'main_side']">
        <div className="space-y-4 lg:[grid-area:main]">
          {!w.signer ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
              Connect your account (panel on the right) to see your positions.
            </div>
          ) : positions.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center">
              <p className="text-muted">You have no open positions.</p>
              <Link
                href="/trade"
                className="mt-3 inline-block rounded-lg bg-short px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Open a short →
              </Link>
            </div>
          ) : (
            positions.map((p) => (
              <PositionCard
                key={p.coin}
                position={p}
                market={markets.find((m) => m.name === p.coin)}
                onChanged={refresh}
              />
            ))
          )}
        </div>

        <div className="lg:[grid-area:side]">
          <WalletPanel
            account={account}
            stale={stale}
            markets={markets}
            onChanged={refresh}
          />
        </div>
      </div>
    </div>
  );
}

function PositionCard({
  position,
  market,
  onChanged,
}: {
  position: OpenPosition;
  market?: Market;
  onChanged?: () => void;
}) {
  const w = useWallet();
  const { network } = useNetwork();
  const isShort = position.szi < 0;
  const sizeAbs = Math.abs(position.szi);
  const entry = position.entryPx ?? 0;
  const mark = market?.markPx ?? entry;

  // Interactive "what-if" price. Starts at the live mark.
  const [hypo, setHypo] = useState<number>(mark);
  const [touched, setTouched] = useState(false);
  const price = touched ? hypo : mark;

  // Range for the slider: wide enough to include liquidation either way.
  const lo = entry * 0.6;
  const hi = entry * 1.6;
  const step = entry > 0 ? entry / 1000 : 1;

  const livePnl = positionPnl(entry, mark, position.szi);
  const hypoPnl = positionPnl(entry, price, position.szi);
  const margin = position.marginUsed || 0;
  const liveRoe = margin > 0 ? (livePnl / margin) * 100 : 0;
  const hypoRoe = margin > 0 ? (hypoPnl / margin) * 100 : 0;

  // Value if you close right now: your margin back + current PnL, minus the
  // exit fee (taker on the current notional).
  const exitFee = mark * sizeAbs * DEFAULT_TAKER_FEE;
  const closeValue = margin + livePnl - exitFee;

  const liq = position.liquidationPx ?? null;
  const pctChange = entry > 0 ? ((price - entry) / entry) * 100 : 0;
  const liquidated =
    liq != null && (isShort ? price >= liq : price <= liq);

  // Fixed scenarios relative to entry.
  const scenarios = [-20, -10, -5, 5, 10, 20].map((pct) => {
    const px = entry * (1 + pct / 100);
    return {
      pct,
      px,
      pnl: positionPnl(entry, px, position.szi),
      roe: margin > 0 ? (positionPnl(entry, px, position.szi) / margin) * 100 : 0,
      dead: liq != null && (isShort ? px >= liq : px <= liq),
    };
  });

  const apr = market ? annualizedFundingPct(market.funding) : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">{position.coin}</span>
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
              isShort ? "bg-short/15 text-short" : "bg-long/15 text-long"
            }`}
          >
            {isShort ? "SHORT" : "LONG"} {position.leverage}x
          </span>
        </div>
        <div className="text-right text-xs text-muted">
          {fmtNum(sizeAbs)} {position.coin} · entry {fmtUsd(entry)} · mark{" "}
          {fmtUsd(mark)}
        </div>
      </div>

      {/* live snapshot */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Unrealized PnL"
          value={`${livePnl >= 0 ? "+" : ""}${fmtUsd(livePnl)}`}
          tone={livePnl >= 0 ? "up" : "down"}
          sub={`${fmtPct(liveRoe, 0)} on margin`}
        />
        <Tile
          label={
            <span className="flex items-center gap-1">
              If you close now <Info k="closePosition" />
            </span>
          }
          value={fmtUsd(closeValue)}
          sub="margin + PnL − fee"
        />
        <Tile
          label="Position value"
          value={fmtUsd(mark * sizeAbs)}
          sub={`margin ${fmtUsd(margin)}`}
        />
        <Tile
          label={
            <span className="flex items-center gap-1">
              Liquidation <Info k="liquidation" />
            </span>
          }
          value={liq != null ? fmtUsd(liq) : "—"}
          tone={liq != null ? "down" : undefined}
          sub={
            liq != null && entry > 0
              ? `${fmtPct(((liq - entry) / entry) * 100, 1)} away`
              : undefined
          }
        />
      </div>

      {/* liquidation distance bar */}
      {liq != null && entry > 0 && (
        <LiqBar entry={entry} mark={mark} liq={liq} isShort={isShort} />
      )}

      {/* interactive what-if */}
      <div className="mt-5 rounded-lg border border-border bg-background p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            What if {position.coin} goes to…
          </span>
          <span className="tabular text-sm">
            {fmtUsd(price)}{" "}
            <span className={pctChange >= 0 ? "text-long" : "text-short"}>
              ({fmtPct(pctChange, 1)})
            </span>
          </span>
        </div>
        <input
          type="range"
          min={lo}
          max={hi}
          step={step}
          value={price}
          onChange={(e) => {
            setHypo(Number(e.target.value));
            setTouched(true);
          }}
          className={`mt-3 w-full ${isShort ? "accent-short" : "accent-long"}`}
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>{fmtUsd(lo)} (−40%)</span>
          <span>entry {fmtUsd(entry)}</span>
          <span>{fmtUsd(hi)} (+60%)</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Mini
            label="PnL"
            value={`${hypoPnl >= 0 ? "+" : ""}${fmtUsd(hypoPnl)}`}
            tone={hypoPnl >= 0 ? "up" : "down"}
          />
          <Mini
            label="Return on margin"
            value={fmtPct(hypoRoe, 0)}
            tone={hypoPnl >= 0 ? "up" : "down"}
          />
          <Mini
            label="Worth if sold"
            value={liquidated ? "Liquidated" : fmtUsd(margin + hypoPnl - exitFee)}
            tone={liquidated ? "down" : undefined}
          />
        </div>
        {liquidated && (
          <p className="mt-2 text-center text-[11px] text-short">
            ⚠ At {fmtUsd(price)} this position would be liquidated — you’d lose
            your {fmtUsd(margin)} margin.
          </p>
        )}
        {touched && (
          <button
            onClick={() => setTouched(false)}
            className="mt-2 w-full text-center text-[11px] text-muted hover:text-foreground"
          >
            ↺ reset to live price
          </button>
        )}
      </div>

      {/* scenario table */}
      <div className="mt-4">
        <div className="mb-1 text-xs text-muted">At a glance</div>
        <div className="grid grid-cols-6 gap-1 text-center text-[11px]">
          {scenarios.map((s) => (
            <div
              key={s.pct}
              className={`rounded-md px-1 py-1.5 ${
                s.dead ? "bg-short/20" : "bg-surface-2"
              }`}
              title={fmtUsd(s.px)}
            >
              <div className={s.pct < 0 ? "text-long" : "text-short"}>
                {s.pct > 0 ? "+" : ""}
                {s.pct}%
              </div>
              <div
                className={`tabular ${s.pnl >= 0 ? "text-long" : "text-short"}`}
              >
                {s.dead ? "💀" : `${s.pnl >= 0 ? "+" : ""}${fmtNum(s.pnl, 0)}`}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted">
          % = move in {position.coin} from entry · value = your $ PnL ·{" "}
          💀 = liquidated. For a short, price falling (left, green) is profit.
          {apr != null && (
            <>
              {" "}
              Funding now {fmtPct(apr, 1)} APR (
              {apr >= 0 ? "you receive" : "you pay"} as a short).
            </>
          )}
        </p>
      </div>

      {/* close controls */}
      {isShort && (
        <CloseControls
          coin={position.coin}
          szi={position.szi}
          market={market}
          network={network}
          signer={w.signer}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}

function CloseControls({
  coin,
  szi,
  market,
  network,
  signer,
  onChanged,
}: {
  coin: string;
  szi: number;
  market?: Market;
  network: "mainnet" | "testnet";
  signer: ReturnType<typeof useWallet>["signer"];
  onChanged?: () => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function doClose(fraction: number) {
    if (!signer || !market) {
      setMsg("Live market data still loading — try again in a second.");
      return;
    }
    setBusy(fraction);
    setMsg(null);
    try {
      await closeShort({
        network,
        wallet: signer,
        market,
        size: Math.abs(szi) * fraction,
      });
      onChanged?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted">Close {coin}:</span>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <button
            key={f}
            disabled={busy !== null}
            onClick={() => doClose(f)}
            className="flex-1 rounded-md border border-border py-1.5 text-xs hover:border-short hover:text-short disabled:opacity-50"
          >
            {busy === f ? "…" : f === 1 ? "Close all" : `${f * 100}%`}
          </button>
        ))}
      </div>
      {msg && <div className="mt-2 text-[11px] text-short">{msg}</div>}
    </div>
  );
}

function LiqBar({
  entry,
  mark,
  liq,
  isShort,
}: {
  entry: number;
  mark: number;
  liq: number;
  isShort: boolean;
}) {
  // Map prices onto a 0-100 track between the two relevant bounds.
  const lo = isShort ? entry : liq;
  const hi = isShort ? liq : entry;
  const span = hi - lo || 1;
  const pos = (v: number) => Math.max(0, Math.min(100, ((v - lo) / span) * 100));
  const markPos = pos(mark);

  return (
    <div className="mt-4">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-long/40 to-short/60">
        <div
          className="absolute -top-1 h-4 w-1 rounded bg-foreground"
          style={{ left: `calc(${markPos}% - 2px)` }}
          title={`Mark ${fmtUsd(mark)}`}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>{isShort ? `entry ${fmtUsd(entry)}` : `liq ${fmtUsd(liq)}`}</span>
        <span className="text-foreground">mark {fmtUsd(mark)}</span>
        <span className={isShort ? "text-short" : ""}>
          {isShort ? `liq ${fmtUsd(liq)}` : `entry ${fmtUsd(entry)}`}
        </span>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: React.ReactNode;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className={`tabular text-sm font-semibold ${
          tone === "up" ? "text-long" : tone === "down" ? "text-short" : ""
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </div>
  );
}

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-[10px] text-muted">{label}</div>
      <div
        className={`tabular text-sm font-semibold ${
          tone === "up" ? "text-long" : tone === "down" ? "text-short" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
