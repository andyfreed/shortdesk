"use client";

/**
 * PAPER-TRADING short bot. Everything here is simulated — it places NO real
 * orders. It scans live Hyperliquid data for short signals, opens simulated
 * shorts, and closes them on a small take-profit, a stop-loss, or a timeout,
 * tracking realized P&L net of (simulated) fees and funding.
 *
 * The point is to let you SEE whether a "take tiny profits" short strategy is
 * actually profitable before risking real money. Spoiler: fees make it hard.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { infoClient, type Market, type Network } from "./hyperliquid";
import { DEFAULT_TAKER_FEE, DEFAULT_MAKER_FEE } from "./calc";

export type Strategy =
  | "meanReversion"
  | "momentum"
  | "fundingCarry"
  | "experiment";
export type FeeModel = "taker" | "maker";

export function feeRateFor(model: FeeModel): number {
  return model === "maker" ? DEFAULT_MAKER_FEE : DEFAULT_TAKER_FEE;
}

export interface BotConfig {
  /** which signal decides what to short */
  strategy: Strategy;
  /** taker (market, ~0.045%) or maker (limit, ~0.015%) fees */
  feeModel: FeeModel;
  /** specific coins to scan; empty = auto (top by volume) */
  coins: string[];
  /** simulated starting balance (paper dollars) */
  startBalance: number;
  /** notional USD per simulated short */
  positionSizeUsd: number;
  /** assumed leverage (drives the simulated liquidation price) */
  leverage: number;
  /** take profit target in NET dollars (after fees + funding) */
  takeProfitUsd: number;
  /** stop loss as a % adverse move in price */
  stopLossPct: number;
  /** force-close after this many minutes */
  maxHoldMin: number;
  /** max simultaneous open positions */
  maxConcurrent: number;
  /** mean-reversion: RSI(14) 5m at/above this = overbought → short */
  entryRsi: number;
  /** funding-carry: only short if annualized funding ≥ this % */
  minFundingApr: number;
  /** how many top-volume markets to scan (when coins is empty) */
  scanCount: number;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  strategy: "meanReversion",
  feeModel: "maker",
  coins: [],
  startBalance: 1000,
  positionSizeUsd: 100,
  leverage: 3,
  takeProfitUsd: 0.5,
  stopLossPct: 1.5,
  maxHoldMin: 30,
  maxConcurrent: 3,
  entryRsi: 70,
  minFundingApr: 10,
  scanCount: 15,
};

export interface PaperPosition {
  id: string;
  coin: string;
  entryPrice: number;
  sizeUsd: number;
  sizeCoin: number;
  leverage: number;
  liqPrice: number;
  openedAt: number;
  signal: string; // why it was opened, e.g. "RSI 72" / "-1.8%/1h" / "fund 45% APR"
  fundingRate: number; // per-hour, from signal time
}

export type CloseReason = "take-profit" | "stop-loss" | "timeout" | "liquidated" | "manual";

export interface ClosedTrade {
  id: string;
  coin: string;
  entryPrice: number;
  exitPrice: number;
  sizeUsd: number;
  grossPnl: number;
  fees: number;
  funding: number;
  net: number;
  reason: CloseReason;
  openedAt: number;
  closedAt: number;
}

export interface LogLine {
  t: number;
  text: string;
}

export interface EquityPoint {
  t: number;
  e: number;
}

interface Persisted {
  config: BotConfig;
  running: boolean;
  positions: PaperPosition[];
  closed: ClosedTrade[];
  realized: number;
  equityCurve: EquityPoint[];
}

const KEY = "shortdesk.bot";
const CHECK_MS = 5000;
const SCAN_MS = 45000;

function loadPersisted(key: string): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

// ---- signal math ----

/** Simple RSI(14) from a series of closes. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** % return over the last `bars` candles (e.g. 12 × 5m ≈ last hour). */
export function recentReturnPct(closes: number[], bars = 12): number | null {
  if (closes.length < bars + 1) return null;
  const a = closes[closes.length - 1 - bars];
  const b = closes[closes.length - 1];
  if (!a) return null;
  return ((b - a) / a) * 100;
}

async function fetchCloses(
  network: Network,
  coin: string,
): Promise<number[]> {
  const info = infoClient(network);
  const end = Date.now();
  const start = end - 60 * 5 * 60 * 1000; // ~60 5m candles
  const candles = await info.candleSnapshot({
    coin,
    interval: "5m",
    startTime: start,
    endTime: end,
  });
  return candles.map((c) => Number(c.c)).filter((n) => Number.isFinite(n));
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---- the hook ----

export interface BotOptions {
  /** localStorage key (use distinct keys to run independent paper accounts) */
  storageKey?: string;
  /** force a strategy and hide the picker (for the 3-way comparison) */
  lockedStrategy?: Strategy;
}

export function useBot(
  markets: Market[],
  network: Network,
  opts: BotOptions = {},
) {
  const storageKey = opts.storageKey ?? KEY;
  const locked = opts.lockedStrategy;
  // Load any persisted paper state once, via lazy initializers (no effect).
  const [config, setConfig] = useState<BotConfig>(() => ({
    ...DEFAULT_BOT_CONFIG,
    ...(loadPersisted(storageKey).config ?? {}),
    ...(locked ? { strategy: locked } : {}),
  }));
  // Resume running if it was running last time (survives navigation/reload).
  const [running, setRunning] = useState(
    () => loadPersisted(storageKey).running ?? false,
  );
  const [positions, setPositions] = useState<PaperPosition[]>(
    () => loadPersisted(storageKey).positions ?? [],
  );
  const [closed, setClosed] = useState<ClosedTrade[]>(
    () => loadPersisted(storageKey).closed ?? [],
  );
  const [realized, setRealized] = useState(
    () => loadPersisted(storageKey).realized ?? 0,
  );
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>(
    () => loadPersisted(storageKey).equityCurve ?? [],
  );
  const [log, setLog] = useState<LogLine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [unrealized, setUnrealized] = useState(0);

  // refs the interval callbacks read so they never go stale (synced post-render)
  const positionsRef = useRef<PaperPosition[]>(positions);
  const configRef = useRef(config);
  const marketsRef = useRef(markets);
  const realizedRef = useRef(realized);
  const lastScan = useRef(0);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);
  useEffect(() => {
    realizedRef.current = realized;
  }, [realized]);

  // persist on change (to this instance's own key)
  useEffect(() => {
    const data: Persisted = {
      config,
      running,
      positions,
      closed,
      realized,
      equityCurve,
    };
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [storageKey, config, running, positions, closed, realized, equityCurve]);

  const addLog = useCallback((text: string) => {
    setLog((l) => [{ t: Date.now(), text }, ...l].slice(0, 100));
  }, []);

  const closePosition = useCallback(
    (pos: PaperPosition, exitPrice: number, reason: CloseReason) => {
      const grossPnl = pos.sizeCoin * (pos.entryPrice - exitPrice);
      const feeRate = feeRateFor(configRef.current.feeModel);
      const fees =
        pos.sizeUsd * feeRate + exitPrice * pos.sizeCoin * feeRate;
      const hours = (Date.now() - pos.openedAt) / 3_600_000;
      // short receives funding when rate positive
      const funding = pos.sizeUsd * pos.fundingRate * hours;
      const net = grossPnl - fees + funding;
      const trade: ClosedTrade = {
        id: pos.id,
        coin: pos.coin,
        entryPrice: pos.entryPrice,
        exitPrice,
        sizeUsd: pos.sizeUsd,
        grossPnl,
        fees,
        funding,
        net,
        reason,
        openedAt: pos.openedAt,
        closedAt: Date.now(),
      };
      setPositions((ps) => ps.filter((p) => p.id !== pos.id));
      setClosed((c) => [trade, ...c].slice(0, 500));
      setRealized((r) => r + net);
      addLog(
        `Closed ${pos.coin} @ ${exitPrice.toFixed(4)} (${reason}) → net ${net >= 0 ? "+" : ""}$${net.toFixed(3)}`,
      );
    },
    [addLog],
  );

  const closeAll = useCallback(
    async (reason: CloseReason = "manual") => {
      const info = infoClient(network);
      const mids = await info.allMids();
      positionsRef.current.forEach((p) => {
        const px = Number(mids[p.coin]);
        if (Number.isFinite(px)) closePosition(p, px, reason);
      });
    },
    [network, closePosition],
  );

  const reset = useCallback(() => {
    setPositions([]);
    setClosed([]);
    setRealized(0);
    setEquityCurve([]);
    setLog([]);
    setUnrealized(0);
  }, []);

  // main loop
  useEffect(() => {
    if (!running) return;
    let active = true;

    const tick = async () => {
      const cfg = configRef.current;
      const info = infoClient(network);

      // 1) manage open positions every tick
      let mids: Record<string, string> = {};
      try {
        mids = await info.allMids();
      } catch {
        return;
      }
      if (!active) return;

      const feeRate = feeRateFor(cfg.feeModel);
      let unreal = 0;
      for (const p of positionsRef.current) {
        const px = Number(mids[p.coin]);
        if (!Number.isFinite(px)) continue;
        const gross = p.sizeCoin * (p.entryPrice - px);
        // Round-trip fees: entry on entry notional + exit on current notional.
        const roundTripFees = (p.sizeUsd + px * p.sizeCoin) * feeRate;
        const hours = (Date.now() - p.openedAt) / 3_600_000;
        const funding = p.sizeUsd * p.fundingRate * hours;
        // NET of fees + funding — so a "take-profit" is never eaten by fees.
        const net = gross - roundTripFees + funding;
        unreal += gross;
        const ageMin = (Date.now() - p.openedAt) / 60000;
        if (px >= p.liqPrice) closePosition(p, p.liqPrice, "liquidated");
        else if (net >= cfg.takeProfitUsd) closePosition(p, px, "take-profit");
        else if (px >= p.entryPrice * (1 + cfg.stopLossPct / 100))
          closePosition(p, px, "stop-loss");
        else if (ageMin >= cfg.maxHoldMin) closePosition(p, px, "timeout");
      }
      setUnrealized(unreal);

      // record an equity-curve point each tick
      const eq = cfg.startBalance + realizedRef.current + unreal;
      setEquityCurve((c) => [...c, { t: Date.now(), e: eq }].slice(-300));

      // 2) scan for new shorts on the slower cadence
      if (
        Date.now() - lastScan.current >= SCAN_MS &&
        positionsRef.current.length < cfg.maxConcurrent
      ) {
        lastScan.current = Date.now();
        setScanning(true);
        try {
          const held = new Set(positionsRef.current.map((p) => p.coin));
          const wanted = cfg.coins.map((c) => c.toUpperCase());
          const universe = [...marketsRef.current]
            .filter((m) => !held.has(m.name))
            .filter((m) => (wanted.length ? wanted.includes(m.name) : true))
            .sort((a, b) => b.dayVolumeUsd - a.dayVolumeUsd)
            .slice(0, wanted.length ? wanted.length : cfg.scanCount);

          // score candidates per the selected strategy
          let best: { m: Market; score: number; signal: string } | null = null;
          const consider = (m: Market, score: number, signal: string) => {
            if (!best || score > best.score) best = { m, score, signal };
          };

          // Experiment ("relative-strength fade") needs a market benchmark:
          // short the alt that has run furthest AHEAD of BTC over the last hour,
          // betting the excess relative move mean-reverts. Fetch BTC once.
          let btcRet = 0;
          if (cfg.strategy === "experiment") {
            try {
              btcRet = recentReturnPct(await fetchCloses(network, "BTC"), 12) ?? 0;
            } catch {
              /* benchmark unavailable; treat as 0 */
            }
          }

          for (const m of universe) {
            try {
              if (cfg.strategy === "fundingCarry") {
                const apr = m.funding * 24 * 365 * 100;
                if (apr >= cfg.minFundingApr)
                  consider(m, apr, `fund ${apr.toFixed(0)}% APR`);
              } else {
                const closes = await fetchCloses(network, m.name);
                if (cfg.strategy === "meanReversion") {
                  const r = rsi(closes);
                  if (r != null && r >= cfg.entryRsi)
                    consider(m, r, `RSI ${r.toFixed(0)}`);
                } else if (cfg.strategy === "momentum") {
                  // momentum: short coins already falling over the last hour
                  const ret = recentReturnPct(closes, 12);
                  if (ret != null && ret <= -0.5)
                    consider(m, -ret, `${ret.toFixed(1)}%/1h`);
                } else {
                  // experiment: short the biggest relative outperformer vs BTC
                  const ret = recentReturnPct(closes, 12);
                  if (ret != null && ret > 0) {
                    const rel = ret - btcRet;
                    if (rel >= 2) consider(m, rel, `+${rel.toFixed(1)}% vs BTC`);
                  }
                }
              }
            } catch {
              /* skip this coin */
            }
            if (!active) return;
          }

          if (best && positionsRef.current.length < cfg.maxConcurrent) {
            const { m, signal } = best as { m: Market; signal: string };
            const px = Number(mids[m.name]) || m.markPx;
            const sizeCoin = cfg.positionSizeUsd / px;
            const liqPrice = px * (1 + 1 / cfg.leverage);
            const pos: PaperPosition = {
              id: uid(),
              coin: m.name,
              entryPrice: px,
              sizeUsd: cfg.positionSizeUsd,
              sizeCoin,
              leverage: cfg.leverage,
              liqPrice,
              openedAt: Date.now(),
              signal,
              fundingRate: m.funding,
            };
            setPositions((ps) => [...ps, pos]);
            addLog(`Opened SHORT ${m.name} @ ${px.toFixed(4)} (${signal})`);
          }
        } finally {
          if (active) setScanning(false);
        }
      }
    };

    tick();
    const id = setInterval(tick, CHECK_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [running, network, closePosition, addLog]);

  // derived stats
  const wins = closed.filter((c) => c.net > 0).length;
  const losses = closed.filter((c) => c.net <= 0).length;
  const totalFees = closed.reduce((s, c) => s + c.fees, 0);
  const equity = config.startBalance + realized + unrealized;
  const feeRate = feeRateFor(config.feeModel);
  // gross move (per position notional) needed just to cover round-trip fees
  const breakevenUsd = config.positionSizeUsd * feeRate * 2;

  return {
    config,
    setConfig,
    running,
    setRunning,
    positions,
    closed,
    equityCurve,
    log,
    scanning,
    realized,
    unrealized,
    equity,
    wins,
    losses,
    totalFees,
    feeRate,
    breakevenUsd,
    closeAll,
    reset,
  };
}
