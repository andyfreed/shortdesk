#!/usr/bin/env node
/**
 * ShortDesk — standalone 24/7 FUNDING-FARM runner (PAPER).
 *
 * Runs the delta-neutral funding-farm paper simulation continuously, no
 * browser required, persisting state to JSON so it resumes across restarts.
 *
 *   node runner/funding-farm-runner.mjs
 *
 * Config via env vars — see runner/README.md. Never places real orders.
 */
import { createFarm, configFromEnv } from "./farm-core.mjs";

const config = configFromEnv();
const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);
const farm = createFarm(config, log);

log(
  `Funding-farm runner started (PAPER). size $${config.perPositionUsd}/leg, ` +
    `max ${config.maxPositions}, entry ≥${config.minEntryApr}% APR, ` +
    `exit <${config.exitApr}% APR. State: ${config.statePath}`,
);

farm.start();

// periodic status line
setInterval(() => {
  const s = farm.status();
  log(
    `equity $${s.equity.toFixed(2)} | realized ${s.realized >= 0 ? "+" : ""}$${s.realized.toFixed(3)} | open ${s.openCount} | closed ${s.recentClosed.length}`,
  );
}, config.tickMs);
