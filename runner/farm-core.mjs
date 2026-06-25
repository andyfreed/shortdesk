/**
 * Shared funding-farm paper engine used by both the CLI runner and the HTTP
 * control server. Pure paper simulation — never places real orders.
 */
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

export function num(v, d) {
  const n = v == null ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

export function configFromEnv(env = process.env) {
  return {
    startBalance: num(env.START_BALANCE, 1000),
    perPositionUsd: num(env.SIZE_USD, 200),
    maxPositions: num(env.MAX_POSITIONS, 5),
    minEntryApr: num(env.MIN_ENTRY_APR, 10),
    exitApr: num(env.EXIT_APR, 2),
    minVolumeUsd: num(env.MIN_VOLUME, 5_000_000),
    feeRate: num(env.FEE_RATE, 0.00015),
    tickMs: num(env.TICK_MS, 30_000),
    statePath: env.STATE_PATH || "farm-state.json",
  };
}

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Create a farm engine. `onLog` is called with each log line.
 */
export function createFarm(config, onLog = () => {}) {
  const info = new InfoClient({ transport: new HttpTransport() });
  let timer = null;
  let running = false;

  let state = load();

  function load() {
    if (existsSync(config.statePath)) {
      try {
        return JSON.parse(readFileSync(config.statePath, "utf8"));
      } catch {
        /* fresh */
      }
    }
    return { realized: 0, positions: [], closed: [] };
  }

  function save() {
    try {
      writeFileSync(config.statePath, JSON.stringify(state, null, 2));
    } catch {
      /* ignore */
    }
  }

  function unrealized() {
    return state.positions.reduce(
      (s, p) =>
        s + p.accruedFunding - p.openFees - 2 * p.notional * config.feeRate,
      0,
    );
  }

  function equity() {
    return config.startBalance + state.realized + unrealized();
  }

  async function tick() {
    const [meta, ctxs] = await info.metaAndAssetCtxs();
    const now = Date.now();
    const byName = new Map();
    meta.universe.forEach((u, i) => {
      const ctx = ctxs[i];
      if (ctx)
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
      if (apr < config.exitApr) {
        const closeFees = 2 * p.notional * config.feeRate;
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
        onLog(
          `CLOSE ${p.coin} funding $${p.accruedFunding.toFixed(3)} net ${net >= 0 ? "+" : ""}$${net.toFixed(3)}`,
        );
      } else survivors.push(p);
    }
    state.positions = survivors;

    // open
    if (state.positions.length < config.maxPositions) {
      const held = new Set(state.positions.map((p) => p.coin));
      const cands = [];
      for (const [coin, m] of byName) {
        if (held.has(coin) || m.vol < config.minVolumeUsd) continue;
        const apr = m.funding * 24 * 365 * 100;
        if (apr >= config.minEntryApr) cands.push({ coin, m, apr });
      }
      cands.sort((a, b) => b.m.funding - a.m.funding);
      for (const c of cands) {
        if (state.positions.length >= config.maxPositions) break;
        state.positions.push({
          id: uid(),
          coin: c.coin,
          notional: config.perPositionUsd,
          openedAt: now,
          lastAccrueAt: now,
          openFees: 2 * config.perPositionUsd * config.feeRate,
          accruedFunding: 0,
          entryApr: c.apr,
          hourlyFunding: c.m.funding,
        });
        onLog(`OPEN  ${c.coin} @ ${c.apr.toFixed(0)}% APR funding`);
      }
    }

    save();
  }

  return {
    get running() {
      return running;
    },
    config,
    async tick() {
      await tick();
    },
    start() {
      if (running) return;
      running = true;
      tick().catch((e) => onLog(`tick error: ${e.message}`));
      timer = setInterval(() => {
        tick().catch((e) => onLog(`tick error: ${e.message}`));
      }, config.tickMs);
    },
    stop() {
      running = false;
      if (timer) clearInterval(timer);
      timer = null;
    },
    status() {
      return {
        running,
        equity: equity(),
        realized: state.realized,
        unrealized: unrealized(),
        openCount: state.positions.length,
        positions: state.positions.map((p) => ({
          coin: p.coin,
          entryApr: p.entryApr,
          currentApr: p.hourlyFunding * 24 * 365 * 100,
          accruedFunding: p.accruedFunding,
          ageHours: (Date.now() - p.openedAt) / 3_600_000,
        })),
        recentClosed: state.closed.slice(0, 20),
        config: {
          perPositionUsd: config.perPositionUsd,
          maxPositions: config.maxPositions,
          minEntryApr: config.minEntryApr,
          exitApr: config.exitApr,
          startBalance: config.startBalance,
        },
      };
    },
  };
}
