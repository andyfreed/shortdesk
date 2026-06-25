"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useMarkets } from "@/lib/useMarkets";
import { useAccountState } from "@/lib/useAccount";
import { useNetwork, NetworkToggle } from "@/lib/network";
import { useWallet } from "@/lib/wallet";
import {
  placeShort,
  setLeverage,
  type Market,
  type OrderType,
  type Tif,
} from "@/lib/hyperliquid";
import {
  summarizeShort,
  shortPnl,
  shortRoePct,
  DEFAULT_TAKER_FEE,
  DEFAULT_MAKER_FEE,
} from "@/lib/calc";
import {
  fmtUsd,
  fmtPct,
  fmtNum,
  annualizedFundingPct,
  sizeToWire,
} from "@/lib/format";
import { Label, Info } from "@/components/Info";
import { WalletPanel } from "@/components/WalletPanel";

type AmountMode = "usd" | "coin";
type MarginMode = "isolated" | "cross";

export function TradeTerminal() {
  const params = useSearchParams();
  const { network } = useNetwork();
  const { markets, loading, error, refresh } = useMarkets(network);
  const w = useWallet();
  const { account, stale, refresh: refreshAccount } = useAccountState(
    network,
    w.address,
  );

  const [coin, setCoin] = useState(params.get("coin")?.toUpperCase() ?? "BTC");
  const [marginMode, setMarginMode] = useState<MarginMode>("isolated");
  const [leverage, setLev] = useState(5);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [tif, setTif] = useState<Tif>("Gtc");
  const [amountMode, setAmountMode] = useState<AmountMode>("usd");
  const [amount, setAmount] = useState("500");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage] = useState(5);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");

  const market = useMemo(
    () => markets.find((m) => m.name === coin),
    [markets, coin],
  );

  // Seed/reset the limit price to the current coin's mark and clamp leverage to
  // its max whenever the coin changes (or when its market first loads). This is
  // React's "adjust state during render" pattern — guarded so it runs once per
  // coin and never overwrites a price the user has edited.
  const [seededCoin, setSeededCoin] = useState("");
  if (market && coin !== seededCoin) {
    setSeededCoin(coin);
    setLimitPrice(String(market.markPx));
    setLev((l) => Math.min(l, market.maxLeverage));
  }

  if (loading && !market && !error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center text-muted">
        Loading live markets…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MarketPicker markets={markets} coin={coin} onChange={setCoin} />
          {market && <MarketHeader market={market} />}
        </div>
        <div className="flex items-center gap-2">
          <NetworkToggle />
          <Link
            href="/learn"
            className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            Guide
          </Link>
        </div>
      </div>

      {error && (
        <Banner tone="warn">
          Couldn’t load live market data ({error}).{" "}
          <button onClick={refresh} className="underline">
            Retry
          </button>
          .
        </Banner>
      )}

      {network === "mainnet" ? (
        <Banner tone="warn">
          You are on <strong>mainnet</strong> — orders use real funds. Switch to{" "}
          <strong>testnet</strong> (top right) to practice with fake money
          first.
        </Banner>
      ) : (
        <Banner tone="info">
          You are on <strong>testnet</strong> — fake money for practice. Get
          test USDC from the{" "}
          <a
            href="https://app.hyperliquid-testnet.xyz/drip"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            testnet faucet
          </a>
          , then it appears in your Perps balance here.
        </Banner>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {market ? (
            <ShortForm
              market={market}
              perpsBalance={account?.accountValue ?? 0}
              connected={!!w.signer}
              marginMode={marginMode}
              setMarginMode={setMarginMode}
              leverage={leverage}
              setLev={setLev}
              orderType={orderType}
              setOrderType={setOrderType}
              tif={tif}
              setTif={setTif}
              amountMode={amountMode}
              setAmountMode={setAmountMode}
              amount={amount}
              setAmount={setAmount}
              limitPrice={limitPrice}
              setLimitPrice={setLimitPrice}
              slippage={slippage}
              setSlippage={setSlippage}
              reduceOnly={reduceOnly}
              setReduceOnly={setReduceOnly}
              takeProfit={takeProfit}
              setTakeProfit={setTakeProfit}
              stopLoss={stopLoss}
              setStopLoss={setStopLoss}
            />
          ) : !error ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-muted">
              Market “{coin}” not found on {network}.
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <WalletPanel
            account={account}
            stale={stale}
            markets={markets}
            onChanged={refreshAccount}
          />
          {market && (
            <ExecutePanel
              market={market}
              perpsBalance={account?.accountValue ?? 0}
              connected={!!w.signer}
              marginMode={marginMode}
              leverage={leverage}
              orderType={orderType}
              tif={tif}
              amountMode={amountMode}
              amount={amount}
              limitPrice={limitPrice}
              slippage={slippage}
              reduceOnly={reduceOnly}
              takeProfit={takeProfit}
              stopLoss={stopLoss}
              onPlaced={refreshAccount}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- pieces ----------------------------- */

function MarketPicker({
  markets,
  coin,
  onChange,
}: {
  markets: Market[];
  coin: string;
  onChange: (c: string) => void;
}) {
  return (
    <select
      value={coin}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-surface px-3 py-2 text-lg font-semibold outline-none focus:border-accent"
    >
      {markets.map((m) => (
        <option key={m.name} value={m.name}>
          {m.name}
        </option>
      ))}
    </select>
  );
}

function MarketHeader({ market }: { market: Market }) {
  const up = (market.change24hPct ?? 0) >= 0;
  const apr = annualizedFundingPct(market.funding);
  return (
    <div className="flex items-center gap-4 text-sm">
      <div>
        <div className="text-xs text-muted">Mark</div>
        <div className="tabular text-base">{fmtUsd(market.markPx)}</div>
      </div>
      <div>
        <div className="text-xs text-muted">24h</div>
        <div className={`tabular ${up ? "text-long" : "text-short"}`}>
          {fmtPct(market.change24hPct)}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1 text-xs text-muted">
          Funding (APR) <Info k="funding" />
        </div>
        <div className={`tabular ${apr >= 0 ? "text-long" : "text-short"}`}>
          {fmtPct(apr)}
        </div>
      </div>
    </div>
  );
}

interface FormProps {
  market: Market;
  perpsBalance: number;
  connected: boolean;
  marginMode: MarginMode;
  setMarginMode: (m: MarginMode) => void;
  leverage: number;
  setLev: (n: number) => void;
  orderType: OrderType;
  setOrderType: (o: OrderType) => void;
  tif: Tif;
  setTif: (t: Tif) => void;
  amountMode: AmountMode;
  setAmountMode: (m: AmountMode) => void;
  amount: string;
  setAmount: (s: string) => void;
  limitPrice: string;
  setLimitPrice: (s: string) => void;
  slippage: number;
  setSlippage: (n: number) => void;
  reduceOnly: boolean;
  setReduceOnly: (b: boolean) => void;
  takeProfit: string;
  setTakeProfit: (s: string) => void;
  stopLoss: string;
  setStopLoss: (s: string) => void;
}

function ShortForm(props: FormProps) {
  const { market } = props;
  const lev = props.leverage;
  const levPct = (lev / market.maxLeverage) * 100;
  const refPrice =
    props.orderType === "limit" && Number(props.limitPrice) > 0
      ? Number(props.limitPrice)
      : market.markPx;

  // Convert the amount when switching USD <-> coin so the position stays equal.
  function switchAmountMode(next: AmountMode) {
    if (next === props.amountMode) return;
    const val = Number(props.amount);
    if (Number.isFinite(val) && val > 0 && refPrice > 0) {
      props.setAmount(
        next === "coin"
          ? String(+(val / refPrice).toFixed(6))
          : String(+(val * refPrice).toFixed(2)),
      );
    }
    props.setAmountMode(next);
  }

  // %-of-balance buttons size in USD notional from the Perps balance.
  function setPct(pct: number) {
    const notional = props.perpsBalance * lev * pct;
    if (notional > 0) {
      props.setAmountMode("usd");
      props.setAmount(String(+notional.toFixed(2)));
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-md bg-short/15 px-2 py-1 text-sm font-semibold text-short">
          SHORT {market.name}
        </span>
        <span className="text-xs text-muted">
          Sell to open · profits if price falls
        </span>
      </div>

      {/* margin mode */}
      <div className="mb-4">
        <Label k="marginMode">Margin mode</Label>
        <div className="mt-1.5 inline-flex rounded-lg border border-border p-0.5 text-sm">
          {(["isolated", "cross"] as const).map((m) => (
            <button
              key={m}
              onClick={() => props.setMarginMode(m)}
              className={`rounded-md px-3 py-1.5 capitalize ${
                props.marginMode === m
                  ? "bg-surface-2 text-foreground"
                  : "text-muted"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* leverage */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <Label k="leverage">Leverage</Label>
          <span className="tabular text-sm font-semibold">{lev}x</span>
        </div>
        <input
          type="range"
          min={1}
          max={market.maxLeverage}
          step={1}
          value={lev}
          onChange={(e) => props.setLev(Number(e.target.value))}
          className="mt-2 w-full accent-short"
          style={{
            background: `linear-gradient(to right, var(--short) ${levPct}%, var(--border) ${levPct}%)`,
          }}
        />
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>1x</span>
          <span>max {market.maxLeverage}x</span>
        </div>
        {lev > 5 && (
          <p className="mt-1 text-[11px] text-warn">
            Above 5x is high risk for beginners — your liquidation price sits
            very close to entry.
          </p>
        )}
      </div>

      {/* order type */}
      <div className="mb-4">
        <Label k="orderType">Order type</Label>
        <div className="mt-1.5 inline-flex rounded-lg border border-border p-0.5 text-sm">
          {(["market", "limit"] as const).map((o) => (
            <button
              key={o}
              onClick={() => props.setOrderType(o)}
              className={`rounded-md px-3 py-1.5 capitalize ${
                props.orderType === o
                  ? "bg-surface-2 text-foreground"
                  : "text-muted"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </div>

      {/* amount */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <Label k="size">Order size</Label>
          <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
            {(["usd", "coin"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchAmountMode(m)}
                className={`rounded px-2 py-0.5 ${
                  props.amountMode === m
                    ? "bg-surface-2 text-foreground"
                    : "text-muted"
                }`}
              >
                {m === "usd" ? "USD" : market.name}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-1.5 flex items-center rounded-lg border border-border bg-background px-3">
          <input
            value={props.amount}
            onChange={(e) => props.setAmount(e.target.value)}
            inputMode="decimal"
            className="w-full bg-transparent py-2.5 text-sm outline-none"
            placeholder="0.00"
          />
          <span className="text-xs text-muted">
            {props.amountMode === "usd" ? "USD (position value)" : market.name}
          </span>
        </div>
        {props.connected && props.perpsBalance > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="flex items-center gap-1 text-[10px] text-muted">
              % of balance <Info k="percentSize" />
            </span>
            {[0.25, 0.5, 0.75, 1].map((p) => (
              <button
                key={p}
                onClick={() => setPct(p)}
                className="flex-1 rounded-md border border-border py-1 text-[11px] text-muted hover:border-accent hover:text-accent"
              >
                {p === 1 ? "Max" : `${p * 100}%`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* limit price + TIF / slippage */}
      {props.orderType === "limit" ? (
        <div className="mb-4 space-y-3">
          <div>
            <Label>Limit price</Label>
            <div className="mt-1.5 flex items-center rounded-lg border border-border bg-background px-3">
              <input
                value={props.limitPrice}
                onChange={(e) => props.setLimitPrice(e.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent py-2.5 text-sm outline-none"
              />
              <span className="text-xs text-muted">USD</span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              Your short only fills at this price or higher.
            </p>
          </div>
          <div>
            <Label k="timeInForce">Time-in-force</Label>
            <div className="mt-1.5 inline-flex rounded-lg border border-border p-0.5 text-xs">
              {(
                [
                  ["Gtc", "GTC (rest)"],
                  ["Ioc", "IOC (now)"],
                  ["Alo", "ALO (maker)"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => props.setTif(v)}
                  className={`rounded-md px-2.5 py-1 ${
                    props.tif === v
                      ? "bg-surface-2 text-foreground"
                      : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <Label k="slippage">Slippage tolerance</Label>
          <div className="mt-1.5 flex items-center gap-2">
            {[1, 3, 5, 10].map((s) => (
              <button
                key={s}
                onClick={() => props.setSlippage(s)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  props.slippage === s
                    ? "border-accent text-accent"
                    : "border-border text-muted"
                }`}
              >
                {s}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* protect the position: TP / SL */}
      <div className="mb-4 rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-1 text-xs font-medium text-muted">
          Protect this position (optional) <Info k="tpslGrouping" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <Label k="takeProfit">Take-profit ↓</Label>
            <input
              value={props.takeProfit}
              onChange={(e) => props.setTakeProfit(e.target.value)}
              inputMode="decimal"
              placeholder="price below entry"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <Label k="stopLoss">Stop-loss ↑</Label>
            <input
              value={props.stopLoss}
              onChange={(e) => props.setStopLoss(e.target.value)}
              inputMode="decimal"
              placeholder="price above entry"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-2.5 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
        </div>
      </div>

      {/* reduce-only */}
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={props.reduceOnly}
          onChange={(e) => props.setReduceOnly(e.target.checked)}
          className="accent-accent"
        />
        <span className="flex items-center gap-1">
          Reduce-only (only shrink/close an existing position){" "}
          <Info k="reduceOnly" />
        </span>
      </label>

      <p className="mt-3 text-[11px] text-muted">
        Looking for scale or TWAP orders?{" "}
        <Link href="/learn#scaleOrder" className="text-accent hover:underline">
          What those are
        </Link>{" "}
        — advanced; available on Hyperliquid’s pro interface.
      </p>
    </div>
  );
}

/* ------------------------ execute + calculator ------------------------ */

interface ExecProps {
  market: Market;
  perpsBalance: number;
  connected: boolean;
  marginMode: MarginMode;
  leverage: number;
  orderType: OrderType;
  tif: Tif;
  amountMode: AmountMode;
  amount: string;
  limitPrice: string;
  slippage: number;
  reduceOnly: boolean;
  takeProfit: string;
  stopLoss: string;
  onPlaced?: () => void;
}

function ExecutePanel(props: ExecProps) {
  const { market } = props;
  const { network } = useNetwork();
  const w = useWallet();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(
    null,
  );

  const limitOk =
    props.orderType !== "limit" || Number(props.limitPrice) > 0;
  const entryPrice =
    props.orderType === "limit"
      ? Number(props.limitPrice) || 0
      : market.markPx;

  const amt = Number(props.amount) || 0;
  const size =
    props.amountMode === "coin" ? amt : entryPrice > 0 ? amt / entryPrice : 0;

  const inputs = {
    entryPrice,
    size,
    leverage: props.leverage,
    maxLeverage: market.maxLeverage,
  };
  const feeRate =
    props.orderType === "market" ? DEFAULT_TAKER_FEE : DEFAULT_MAKER_FEE;
  const summary = summarizeShort(inputs, {
    feeRate,
    hourlyFundingRate: market.funding,
  });

  const scenarios = [-10, -5, 5, 10].map((pct) => {
    const px = entryPrice * (1 + pct / 100);
    return {
      pct,
      px,
      pnl: shortPnl(entryPrice, px, size),
      roe: shortRoePct(inputs, px),
    };
  });

  const overBalance =
    props.connected &&
    props.perpsBalance > 0 &&
    summary.margin > props.perpsBalance;
  const baseValid =
    size > 0 && entryPrice > 0 && summary.margin > 0 && limitOk;
  const valid = baseValid && !overBalance;
  const danger = summary.liqDistancePct < 5;

  const tp = Number(props.takeProfit) || 0;
  const sl = Number(props.stopLoss) || 0;
  const tpWarn = tp > 0 && tp >= entryPrice;
  const slWarn = sl > 0 && sl <= entryPrice;

  async function execute() {
    if (!w.signer || !valid) return;
    setBusy(true);
    setMsg(null);
    try {
      await setLeverage({
        network,
        wallet: w.signer,
        market,
        leverage: props.leverage,
        isCross: props.marginMode === "cross",
      });
      const res = await placeShort({
        network,
        wallet: w.signer,
        market,
        size,
        orderType: props.orderType,
        limitPrice: Number(props.limitPrice),
        slippage: props.slippage / 100,
        tif: props.tif,
        reduceOnly: props.reduceOnly,
        takeProfitPrice: tp > 0 ? tp : undefined,
        stopLossPrice: sl > 0 ? sl : undefined,
      });
      const status = res?.response?.data?.statuses?.[0];
      if (status && typeof status === "object" && "error" in status) {
        setMsg({ tone: "err", text: String(status.error) });
      } else if (status && typeof status === "object" && "filled" in status) {
        setMsg({
          tone: "ok",
          text: `Filled ${status.filled.totalSz} ${market.name} @ ${fmtUsd(
            Number(status.filled.avgPx),
          )}`,
        });
      } else {
        setMsg({
          tone: "ok",
          text: "Order placed — resting in the order book until the price reaches your limit.",
        });
      }
      setConfirming(false);
      props.onPlaced?.();
    } catch (e) {
      setMsg({
        tone: "err",
        text: e instanceof Error ? e.message : "Order failed",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold">Order summary</h3>

      <dl className="space-y-1.5 text-sm">
        <Row label="Entry price" value={fmtUsd(entryPrice)} />
        <Row
          label={`Size (${market.name})`}
          value={size > 0 ? sizeToWire(size, market.szDecimals) : "—"}
        />
        <Row
          label={
            <span className="flex items-center gap-1">
              Notional <Info k="notionalHelp" />
            </span>
          }
          value={fmtUsd(summary.notional)}
        />
        <Row label="Margin required" value={fmtUsd(summary.margin)} strong />
        <Row
          label={
            <span className="flex items-center gap-1">
              Liquidation price <Info k="liquidation" />
            </span>
          }
          value={
            valid ? (
              <span className={danger ? "text-short" : ""}>
                {fmtUsd(summary.liqPrice)}{" "}
                <span className="text-xs text-muted">
                  ({fmtPct(summary.liqDistancePct)})
                </span>
              </span>
            ) : (
              "—"
            )
          }
          strong
        />
        <Row
          label="Est. fee (per side, paid on entry + exit)"
          value={fmtUsd(summary.entryFee)}
        />
        <Row
          label={
            <span className="flex items-center gap-1">
              Funding / 8h (est.) <Info k="funding" />
            </span>
          }
          value={
            <span
              className={summary.funding8h >= 0 ? "text-long" : "text-short"}
            >
              {summary.funding8h >= 0 ? "+" : ""}
              {fmtUsd(summary.funding8h)}
            </span>
          }
        />
      </dl>
      <p className="mt-1 text-[10px] text-muted">
        Funding: <span className="text-long">green</span> = you receive it as a
        short; <span className="text-short">red</span> = you pay it. Charged
        hourly.
      </p>

      {overBalance && (
        <div className="mt-3 rounded-lg border border-short/40 bg-short/10 px-3 py-2 text-xs text-short">
          Margin required ({fmtUsd(summary.margin)}) exceeds your Perps balance
          ({fmtUsd(props.perpsBalance)}). Lower the size/leverage or add USDC to
          Perps.
        </div>
      )}

      {valid && danger && !overBalance && (
        <div className="mt-3 rounded-lg border border-short/40 bg-short/10 px-3 py-2 text-xs text-short">
          ⚠ Liquidation is only {fmtPct(summary.liqDistancePct)} away. A small
          move against you wipes out this position. Consider lower leverage.
        </div>
      )}

      {(tpWarn || slWarn) && (
        <div className="mt-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-[11px] text-warn">
          {tpWarn && "Take-profit should be BELOW entry for a short (you profit as price falls). "}
          {slWarn && "Stop-loss should be ABOVE entry for a short (you lose as price rises)."}
        </div>
      )}

      {valid && (
        <div className="mt-3">
          <div className="mb-1 text-xs text-muted">If price moves…</div>
          <div className="grid grid-cols-4 gap-1 text-center text-xs">
            {scenarios.map((s) => (
              <div
                key={s.pct}
                className="rounded-md bg-surface-2 px-1 py-1.5"
                title={`Price ${fmtUsd(s.px)}`}
              >
                <div className={s.pct < 0 ? "text-long" : "text-short"}>
                  {s.pct > 0 ? "+" : ""}
                  {s.pct}%
                </div>
                <div
                  className={`tabular ${
                    s.pnl >= 0 ? "text-long" : "text-short"
                  }`}
                >
                  {s.pnl >= 0 ? "+" : ""}
                  {fmtNum(s.pnl, 0)}
                </div>
                <div className="text-[10px] text-muted">{fmtPct(s.roe, 0)}</div>
              </div>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted">
            Top = price move, middle = $ PnL, bottom = return on your margin.
          </p>
        </div>
      )}

      <div className="mt-4">
        {!w.signer ? (
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-muted">
            Connect above to place this short.
          </div>
        ) : !confirming ? (
          <button
            disabled={!valid}
            onClick={() => setConfirming(true)}
            className="w-full rounded-lg bg-short px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            Short {market.name}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg border border-short/40 bg-short/10 px-3 py-2 text-xs">
              Confirm: short{" "}
              <strong>
                {sizeToWire(size, market.szDecimals)} {market.name}
              </strong>{" "}
              at {props.leverage}x {props.marginMode}, margin{" "}
              <strong>{fmtUsd(summary.margin)}</strong>, liquidation{" "}
              <strong>{fmtUsd(summary.liqPrice)}</strong>.
              {tp > 0 && <> TP {fmtUsd(tp)}.</>}
              {sl > 0 && <> SL {fmtUsd(sl)}.</>}
              {network === "mainnet" && " This uses REAL funds."}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={execute}
                disabled={busy}
                className="flex-1 rounded-lg bg-short px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {busy ? "Placing…" : "Confirm short"}
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            msg.tone === "ok"
              ? "border border-long/40 bg-long/10 text-long"
              : "border border-short/40 bg-short/10 text-short"
          }`}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular ${strong ? "font-semibold" : ""}`}>{value}</dd>
    </div>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "warn" | "info";
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
        tone === "warn"
          ? "border-warn/40 bg-warn/10 text-warn"
          : "border-accent/40 bg-accent/10 text-foreground"
      }`}
    >
      {children}
    </div>
  );
}
