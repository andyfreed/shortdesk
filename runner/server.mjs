#!/usr/bin/env node
/**
 * ShortDesk funding-farm runner with an HTTP control API, so the web app can
 * start/stop/monitor it remotely. PAPER only — never places real orders.
 *
 *   CONTROL_TOKEN=somesecret node runner/server.mjs
 *
 * Endpoints (all require `Authorization: Bearer <CONTROL_TOKEN>`):
 *   GET  /status  → current sim state (equity, positions, recent closed)
 *   POST /start   → start the loop
 *   POST /stop    → stop the loop
 *
 * Env: CONTROL_TOKEN (required), PORT (default 8080), ALLOW_ORIGIN (default *),
 * AUTOSTART=1 to begin running on boot, plus all farm config vars (SIZE_USD…).
 */
import { createServer } from "node:http";
import { createFarm, configFromEnv } from "./farm-core.mjs";

const PORT = Number(process.env.PORT) || 8080;
const TOKEN = process.env.CONTROL_TOKEN;
// Strip any trailing slash — a browser Origin never has one, so "https://x/"
// would never match and would block every request.
const ORIGIN = (process.env.ALLOW_ORIGIN || "*").replace(/\/$/, "");

const log = (m) => console.log(`[${new Date().toISOString()}] ${m}`);

// Stay up even if the token isn't set yet — just reject every request — so the
// service stays healthy and you can generate a domain, then add the token.
if (!TOKEN) {
  log("WARNING: CONTROL_TOKEN is not set. All control requests will be rejected (401) until you add it in your host's variables and redeploy.");
}
const farm = createFarm(configFromEnv(), log);
if (process.env.AUTOSTART === "1") farm.start();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
}

function send(res, code, body) {
  cors(res);
  res.setHeader("Content-Type", "application/json");
  res.writeHead(code);
  res.end(JSON.stringify(body));
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    cors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const auth = req.headers.authorization || "";
  if (!TOKEN || auth !== `Bearer ${TOKEN}`) {
    return send(res, 401, {
      error: TOKEN ? "unauthorized" : "CONTROL_TOKEN not set on the runner",
    });
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === "GET" && url.pathname === "/status") {
    return send(res, 200, farm.status());
  }
  if (req.method === "POST" && url.pathname === "/start") {
    farm.start();
    log("started via API");
    return send(res, 200, { ok: true, running: true });
  }
  if (req.method === "POST" && url.pathname === "/stop") {
    farm.stop();
    log("stopped via API");
    return send(res, 200, { ok: true, running: false });
  }
  return send(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  log(`Control server on :${PORT} (origin ${ORIGIN}, autostart ${process.env.AUTOSTART === "1"})`);
});
