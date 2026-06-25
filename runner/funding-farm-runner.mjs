#!/usr/bin/env node
/**
 * ShortDesk — standalone 24/7 FUNDING-FARM runner (PAPER by default).
 *
 * Runs the same delta-neutral funding-farm simulation as the web app, but as a
 * plain Node process so it keeps running with no browser open. It reads live
 * Hyperliquid funding rates, simulates shorting high-funding perps against an
 * equal offsetting long (price-neutral), accrues funding net of fees, and
 * rotates out as funding decays. State is persisted to a JSON file so it
 * resumes across restarts.
 *
 *   node runner/funding-farm-runner.mjs
 *
 * Config via env vars (all optional) — see CONFIG below. This NEVER places real
 * orders: it is a paper simulator. Turning it into a live trader would require
 * adding signed exchange calls + a funded agent key, which is intentionally not
 * included here.
 */
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const CONFIG = {
  startBalance: num(process.env.START_BALANCE, 1000),
  perPositionUsd: num(process.env.SIZE_USD, 200),
  maxPositions: num(process.env.MAX_POSITIONS, 5),
  minEntryApr: num(process.env.MIN_ENTRY_APR, 10), // %
  exitApr: num(process.env.EXIT_APR, 2), // %
  minVolumeUsd: num(process.env.MIN_VOLUME, 5_000_000),
  feeRate: num(process.env.FEE_RATE, 0.00015), // maker default
  tickMs: num(process.env.TICK_MS, 30_000),
  statePath: process.env.STATE_PATH || "farm-state.json",
};

const info = new InfoClient({ transport: new HttpTransport() });

let state = load();

function load() {
  if (existsSync(CONFIG.statePath)) {
    try {
      return JSON.parse(readFileSync(CONFIG.statePath, "utf8"));
    } catch {
      /* fall through to fresh */
    }
  }
  return { realized: 0, positions: [], closed: [] };
}

function save() {
  writeFileSync(CONFIG.statePath, JSON.stringify(state, null, 2));
}

function num(v, d) {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function tick() {
  const [meta, ctxs] = await info.metaAndAssetCtxs();
  const now = Date.now();
  const byName = new Map();
  meta.universe.forEach((u, i) => {
    const ctx = ctxs[i];
    if (!ctx) return;
    byName.set(u.name, {
      funding: Number(ctx.funding),
      vol: Number(ctx.dayNtlVlm),
    });
  });

  // accrue + exit
  const survivors = [];
  for (const p of state.positions) {
    const m = byName.get(p.coin);
    const hourly = m ? m.funding : p.hourlyFunding;
    const hrs = (now - p.lastAccrueAt) / 3_600_000;
    p.accruedFunding += p.notional * hourly * hrs;
    p.lastAccrueAt = now;
    p.hourlyFunding = hourly;
    const apr = hourly * 24 * 365 * 100;
    if (apr < CONFIG.exitApr) {
      const closeFees = 2 * p.notional * CONFIG.feeRate;
      const net = p.accruedFunding - p.openFees - closeFees;
      state.realized += net;
      state.closed.unshift({
        coin: p.coin,
        hoursHeld: (now - p.openedAt) / 3_600_000,
        fundingCollected: p.accruedFunding,
        fees: p.openFees + closeFees,
        net,
        reason: apr < 0 ? "funding flipped negative" : "funding decayed",
        closedAt: now,
      });
      state.closed = state.closed.slice(0, 500);
      log(
        `CLOSE ${p.coin} (${apr < 0 ? "flipped neg" : "decayed"}) funding $${p.accruedFunding.toFixed(3)} net ${net >= 0 ? "+" : ""}$${net.toFixed(3)}`,
      );
    } else {
      survivors.push(p);
    }
  }
  state.positions = survivors;

  // open new high-funding positions
  if (state.positions.length < CONFIG.maxPositions) {
    const held = new Set(state.positions.map((p) => p.coin));
    const cands = [];
    for (const [coin, m] of byName) {
      if (held.has(coin)) continue;
      if (m.vol < CONFIG.minVolumeUsd) continue;
      const apr = m.funding * 24 * 365 * 100;
      if (apr >= CONFIG.minEntryApr) cands.push({ coin, m, apr });
    }
    cands.sort((a, b) => b.m.funding - a.m.funding);
    for (const c of cands) {
      if (state.positions.length >= CONFIG.maxPositions) break;
      state.positions.push({
        id: uid(),
        coin: c.coin,
        notional: CONFIG.perPositionUsd,
        openedAt: now,
        lastAccrueAt: now,
        openFees: 2 * CONFIG.perPositionUsd * CONFIG.feeRate,
        accruedFunding: 0,
        entryApr: c.apr,
        hourlyFunding: c.m.funding,
      });
      log(`OPEN  ${c.coin} @ ${c.apr.toFixed(0)}% APR funding`);
    }
  }

  const unreal = state.positions.reduce(
    (s, p) => s + p.accruedFunding - p.openFees - 2 * p.notional * CONFIG.feeRate,
    0,
  );
  const equity = CONFIG.startBalance + state.realized + unreal;
  save();
  log(
    `equity $${equity.toFixed(2)} | realized ${state.realized >= 0 ? "+" : ""}$${state.realized.toFixed(3)} | open ${state.positions.length} | closed ${state.closed.length}`,
  );
}

log(
  `Funding-farm runner started (PAPER). size $${CONFIG.perPositionUsd}/leg, ` +
    `max ${CONFIG.maxPositions}, entry ≥${CONFIG.minEntryApr}% APR, exit <${CONFIG.exitApr}% APR. ` +
    `State: ${CONFIG.statePath}`,
);

await tick().catch((e) => log(`tick error: ${e.message}`));
setInterval(() => {
  tick().catch((e) => log(`tick error: ${e.message}`));
}, CONFIG.tickMs);
