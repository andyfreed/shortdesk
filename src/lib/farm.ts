"use client";

/**
 * PAPER delta-neutral FUNDING FARM.
 *
 * The idea (the closest thing here to a real structural edge): short a perp
 * that pays high positive funding AND hold an equal offsetting long (spot or a
 * second venue). Because the two legs cancel, price moves wash out — you're
 * market-neutral — and you simply COLLECT the funding the shorts are paid,
 * minus trading fees on both legs.
 *
 * This simulator models exactly that: price P&L ≈ 0 (delta-neutral), funding
 * accrues each tick from the live rate, and fees are charged on opening and
 * closing both legs. It shows whether collected funding outpaces fees over
 * time. Real-world caveats (basis drift, the long leg's own costs, funding
 * flipping) are noted in the UI.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Market, Network } from "./hyperliquid";
import { feeRateFor, type FeeModel } from "./bot";
import type { EquityPoint } from "./bot";

export interface FarmConfig {
  feeModel: FeeModel;
  startBalance: number;
  /** USD notional PER LEG of each delta-neutral position */
  perPositionUsd: number;
  maxPositions: number;
  /** only open if annualized funding ≥ this % */
  minEntryApr: number;
  /** close once funding APR falls below this (or flips negative) */
  exitApr: number;
  /** ignore illiquid markets below this 24h volume */
  minVolumeUsd: number;
}

export const DEFAULT_FARM_CONFIG: FarmConfig = {
  feeModel: "maker",
  startBalance: 1000,
  perPositionUsd: 200,
  maxPositions: 5,
  minEntryApr: 10,
  exitApr: 2,
  minVolumeUsd: 5_000_000,
};

export interface FarmPosition {
  id: string;
  coin: string;
  notional: number;
  openedAt: number;
  lastAccrueAt: number;
  openFees: number;
  accruedFunding: number;
  entryApr: number;
  currentApr: number;
  hourlyFunding: number;
}

export interface ClosedFarm {
  id: string;
  coin: string;
  notional: number;
  hoursHeld: number;
  fundingCollected: number;
  fees: number;
  net: number;
  reason: string;
  closedAt: number;
}

export interface FarmLog {
  t: number;
  text: string;
}

interface Persisted {
  config: FarmConfig;
  running: boolean;
  positions: FarmPosition[];
  closed: ClosedFarm[];
  realized: number;
  equityCurve: EquityPoint[];
}

const KEY = "shortdesk.farm";
const TICK_MS = 5000;
const REBAL_MS = 20000;

function load(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Persisted) : {};
  } catch {
    return {};
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function useFundingFarm(markets: Market[], network: Network) {
  void network; // funding comes from `markets`; no extra requests needed
  const [config, setConfig] = useState<FarmConfig>(() => ({
    ...DEFAULT_FARM_CONFIG,
    ...(load().config ?? {}),
  }));
  const [running, setRunning] = useState(() => load().running ?? false);
  const [positions, setPositions] = useState<FarmPosition[]>(
    () => load().positions ?? [],
  );
  const [closed, setClosed] = useState<ClosedFarm[]>(() => load().closed ?? []);
  const [realized, setRealized] = useState(() => load().realized ?? 0);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>(
    () => load().equityCurve ?? [],
  );
  const [unrealized, setUnrealized] = useState(0);
  const [log, setLog] = useState<FarmLog[]>([]);

  const configRef = useRef(config);
  const marketsRef = useRef(markets);
  const positionsRef = useRef(positions);
  const realizedRef = useRef(realized);
  const lastRebal = useRef(0);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);
  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);
  useEffect(() => {
    realizedRef.current = realized;
  }, [realized]);

  // persist
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
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [config, running, positions, closed, realized, equityCurve]);

  const addLog = useCallback((text: string) => {
    setLog((l) => [{ t: Date.now(), text }, ...l].slice(0, 100));
  }, []);

  const recordClose = useCallback(
    (p: FarmPosition, now: number, reason: string) => {
      const feeRate = feeRateFor(configRef.current.feeModel);
      const closeFees = 2 * p.notional * feeRate; // close both legs
      const net = p.accruedFunding - p.openFees - closeFees;
      const trade: ClosedFarm = {
        id: p.id,
        coin: p.coin,
        notional: p.notional,
        hoursHeld: (now - p.openedAt) / 3_600_000,
        fundingCollected: p.accruedFunding,
        fees: p.openFees + closeFees,
        net,
        reason,
        closedAt: now,
      };
      setClosed((c) => [trade, ...c].slice(0, 500));
      setRealized((r) => r + net);
      addLog(
        `Closed ${p.coin} (${reason}) → funding $${p.accruedFunding.toFixed(3)}, net ${net >= 0 ? "+" : ""}$${net.toFixed(3)}`,
      );
    },
    [addLog],
  );

  const reset = useCallback(() => {
    setPositions([]);
    setClosed([]);
    setRealized(0);
    setEquityCurve([]);
    setUnrealized(0);
    setLog([]);
  }, []);

  const closeAll = useCallback(() => {
    const now = Date.now();
    positionsRef.current.forEach((p) => recordClose(p, now, "manual"));
    setPositions([]);
  }, [recordClose]);

  useEffect(() => {
    if (!running) return;
    let active = true;

    const tick = () => {
      if (!active) return;
      const cfg = configRef.current;
      const feeRate = feeRateFor(cfg.feeModel);
      const byName = new Map(marketsRef.current.map((m) => [m.name, m]));
      const now = Date.now();

      // accrue funding + exit decayed positions
      const survivors: FarmPosition[] = [];
      for (const p of positionsRef.current) {
        const m = byName.get(p.coin);
        const hourly = m ? m.funding : p.hourlyFunding;
        const hrs = (now - p.lastAccrueAt) / 3_600_000;
        const accrued = p.accruedFunding + p.notional * hourly * hrs;
        const apr = hourly * 24 * 365 * 100;
        const np: FarmPosition = {
          ...p,
          accruedFunding: accrued,
          lastAccrueAt: now,
          currentApr: apr,
          hourlyFunding: hourly,
        };
        if (apr < cfg.exitApr) {
          recordClose(np, now, apr < 0 ? "funding flipped negative" : "funding decayed");
        } else {
          survivors.push(np);
        }
      }

      // rebalance: open new high-funding positions on the slower cadence
      let next = survivors;
      if (now - lastRebal.current >= REBAL_MS && next.length < cfg.maxPositions) {
        lastRebal.current = now;
        const held = new Set(next.map((p) => p.coin));
        const cands = marketsRef.current
          .filter(
            (m) =>
              m.dayVolumeUsd >= cfg.minVolumeUsd &&
              !held.has(m.name) &&
              m.funding * 24 * 365 * 100 >= cfg.minEntryApr,
          )
          .sort((a, b) => b.funding - a.funding);
        next = [...next];
        for (const m of cands) {
          if (next.length >= cfg.maxPositions) break;
          const apr = m.funding * 24 * 365 * 100;
          const openFees = 2 * cfg.perPositionUsd * feeRate;
          next.push({
            id: uid(),
            coin: m.name,
            notional: cfg.perPositionUsd,
            openedAt: now,
            lastAccrueAt: now,
            openFees,
            accruedFunding: 0,
            entryApr: apr,
            currentApr: apr,
            hourlyFunding: m.funding,
          });
          addLog(`Opened delta-neutral ${m.name} @ ${apr.toFixed(0)}% APR funding`);
        }
      }
      setPositions(next);

      // unrealized = accrued funding so far minus open + estimated close fees
      const unreal = next.reduce(
        (s, p) => s + p.accruedFunding - p.openFees - 2 * p.notional * feeRate,
        0,
      );
      setUnrealized(unreal);
      const eq = cfg.startBalance + realizedRef.current + unreal;
      setEquityCurve((c) => [...c, { t: now, e: eq }].slice(-300));
    };

    tick();
    const id = setInterval(tick, TICK_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [running, recordClose, addLog]);

  const totalFunding =
    closed.reduce((s, c) => s + c.fundingCollected, 0) +
    positions.reduce((s, p) => s + p.accruedFunding, 0);
  const totalFees =
    closed.reduce((s, c) => s + c.fees, 0) +
    positions.reduce((s, p) => s + p.openFees, 0);
  const equity = config.startBalance + realized + unrealized;
  const feeRate = feeRateFor(config.feeModel);
  const breakevenHoursAt = (apr: number) =>
    apr > 0 ? (4 * feeRate * 100) / (apr / (365 * 24)) / 100 : Infinity;

  return {
    config,
    setConfig,
    running,
    setRunning,
    positions,
    closed,
    equityCurve,
    log,
    realized,
    unrealized,
    equity,
    totalFunding,
    totalFees,
    breakevenHoursAt,
    reset,
    closeAll,
  };
}
