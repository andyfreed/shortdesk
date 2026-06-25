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
import { DEFAULT_TAKER_FEE } from "./calc";

export interface BotConfig {
  /** simulated starting balance (paper dollars) */
  startBalance: number;
  /** notional USD per simulated short */
  positionSizeUsd: number;
  /** assumed leverage (drives the simulated liquidation price) */
  leverage: number;
  /** take profit target in NET dollars (after fees) */
  takeProfitUsd: number;
  /** stop loss as a % adverse move in price */
  stopLossPct: number;
  /** force-close after this many minutes */
  maxHoldMin: number;
  /** max simultaneous open positions */
  maxConcurrent: number;
  /** RSI(14) on 5m at/above this = overbought → short candidate */
  entryRsi: number;
  /** how many top-volume markets to scan */
  scanCount: number;
}

export const DEFAULT_BOT_CONFIG: BotConfig = {
  startBalance: 1000,
  positionSizeUsd: 100,
  leverage: 3,
  takeProfitUsd: 0.5,
  stopLossPct: 1.5,
  maxHoldMin: 30,
  maxConcurrent: 3,
  entryRsi: 70,
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
  rsi: number;
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

interface Persisted {
  config: BotConfig;
  positions: PaperPosition[];
  closed: ClosedTrade[];
  realized: number;
}

const KEY = "shortdesk.bot";
const CHECK_MS = 5000;
const SCAN_MS = 45000;

function loadPersisted(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
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

export function useBot(markets: Market[], network: Network) {
  // Load any persisted paper state once, via lazy initializers (no effect).
  const [config, setConfig] = useState<BotConfig>(() => ({
    ...DEFAULT_BOT_CONFIG,
    ...(loadPersisted().config ?? {}),
  }));
  const [running, setRunning] = useState(false);
  const [positions, setPositions] = useState<PaperPosition[]>(
    () => loadPersisted().positions ?? [],
  );
  const [closed, setClosed] = useState<ClosedTrade[]>(
    () => loadPersisted().closed ?? [],
  );
  const [realized, setRealized] = useState(() => loadPersisted().realized ?? 0);
  const [log, setLog] = useState<LogLine[]>([]);
  const [scanning, setScanning] = useState(false);
  const [unrealized, setUnrealized] = useState(0);

  // refs the interval callbacks read so they never go stale (synced post-render)
  const positionsRef = useRef<PaperPosition[]>(positions);
  const configRef = useRef(config);
  const marketsRef = useRef(markets);
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

  // persist on change
  useEffect(() => {
    const data: Persisted = { config, positions, closed, realized };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [config, positions, closed, realized]);

  const addLog = useCallback((text: string) => {
    setLog((l) => [{ t: Date.now(), text }, ...l].slice(0, 100));
  }, []);

  const closePosition = useCallback(
    (pos: PaperPosition, exitPrice: number, reason: CloseReason) => {
      const grossPnl = pos.sizeCoin * (pos.entryPrice - exitPrice);
      const fees =
        pos.sizeUsd * DEFAULT_TAKER_FEE + exitPrice * pos.sizeCoin * DEFAULT_TAKER_FEE;
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

      let unreal = 0;
      for (const p of positionsRef.current) {
        const px = Number(mids[p.coin]);
        if (!Number.isFinite(px)) continue;
        const gross = p.sizeCoin * (p.entryPrice - px);
        const roundTripFees = p.sizeUsd * DEFAULT_TAKER_FEE * 2;
        const net = gross - roundTripFees;
        unreal += gross;
        const ageMin = (Date.now() - p.openedAt) / 60000;
        if (px >= p.liqPrice) closePosition(p, p.liqPrice, "liquidated");
        else if (net >= cfg.takeProfitUsd) closePosition(p, px, "take-profit");
        else if (px >= p.entryPrice * (1 + cfg.stopLossPct / 100))
          closePosition(p, px, "stop-loss");
        else if (ageMin >= cfg.maxHoldMin) closePosition(p, px, "timeout");
      }
      setUnrealized(unreal);

      // 2) scan for new shorts on the slower cadence
      if (
        Date.now() - lastScan.current >= SCAN_MS &&
        positionsRef.current.length < cfg.maxConcurrent
      ) {
        lastScan.current = Date.now();
        setScanning(true);
        try {
          const held = new Set(positionsRef.current.map((p) => p.coin));
          const universe = [...marketsRef.current]
            .filter((m) => !held.has(m.name))
            .sort((a, b) => b.dayVolumeUsd - a.dayVolumeUsd)
            .slice(0, cfg.scanCount);

          let best: { m: Market; rsiVal: number } | null = null;
          for (const m of universe) {
            try {
              const closes = await fetchCloses(network, m.name);
              const r = rsi(closes);
              if (r != null && r >= cfg.entryRsi && (!best || r > best.rsiVal)) {
                best = { m, rsiVal: r };
              }
            } catch {
              /* skip this coin */
            }
            if (!active) return;
          }

          if (best && positionsRef.current.length < cfg.maxConcurrent) {
            const m = best.m;
            const px = Number(mids[m.name]) || m.markPx;
            const sizeCoin = cfg.positionSizeUsd / px;
            // simple isolated short liq estimate: entry*(1 + 1/leverage)
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
              rsi: best.rsiVal,
              fundingRate: m.funding,
            };
            setPositions((ps) => [...ps, pos]);
            addLog(
              `Opened SHORT ${m.name} @ ${px.toFixed(4)} (RSI ${best.rsiVal.toFixed(0)} overbought)`,
            );
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

  return {
    config,
    setConfig,
    running,
    setRunning,
    positions,
    closed,
    log,
    scanning,
    realized,
    unrealized,
    equity,
    wins,
    losses,
    totalFees,
    closeAll,
    reset,
  };
}
