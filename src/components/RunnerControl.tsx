"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fmtUsd, fmtPct } from "@/lib/format";

interface RunnerStatus {
  running: boolean;
  equity: number;
  realized: number;
  unrealized: number;
  openCount: number;
  positions: {
    coin: string;
    entryApr: number;
    currentApr: number;
    accruedFunding: number;
    ageHours: number;
  }[];
  recentClosed: {
    coin: string;
    net: number;
    fundingCollected: number;
    fees: number;
    reason: string;
  }[];
  config: { startBalance: number };
}

/**
 * Controls the standalone 24/7 funding-farm runner over its HTTP API. You host
 * the runner (runner/server.mjs) anywhere always-on and paste its URL + token
 * here. Buttons call /start /stop; status is polled from /status.
 */
export function RunnerControl() {
  const ls = (k: string) =>
    typeof window !== "undefined" ? localStorage.getItem(k) ?? "" : "";
  const [host, setHost] = useState(() => ls("shortdesk.runner.host"));
  const [token, setToken] = useState(() => ls("shortdesk.runner.token"));
  const [saved, setSaved] = useState(
    () => !!ls("shortdesk.runner.host") && !!ls("shortdesk.runner.token"),
  );
  const [status, setStatus] = useState<RunnerStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hostRef = useRef(host);
  const tokenRef = useRef(token);
  useEffect(() => {
    hostRef.current = host;
    tokenRef.current = token;
  }, [host, token]);

  const call = useCallback(
    async (path: string, method: "GET" | "POST") => {
      let h = hostRef.current.trim().replace(/\/$/, "");
      // Auto-add https:// — without a scheme the browser treats it as a
      // relative path and hits this app (404) instead of the runner.
      if (h && !/^https?:\/\//i.test(h)) h = `https://${h}`;
      if (!h || !tokenRef.current) throw new Error("Set the host URL and token first.");
      const res = await fetch(`${h}${path}`, {
        method,
        headers: { authorization: `Bearer ${tokenRef.current}` },
      });
      if (res.status === 401) throw new Error("Unauthorized — token doesn't match the runner's CONTROL_TOKEN.");
      if (!res.ok) throw new Error(`Runner returned ${res.status}`);
      return res.json();
    },
    [],
  );

  const refresh = useCallback(async () => {
    try {
      const s = (await call("/status", "GET")) as RunnerStatus;
      setStatus(s);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message} (is the runner running and reachable?)`
          : "Failed to reach runner",
      );
    }
  }, [call]);

  // poll while configured (initial call deferred so it's not a sync effect setState)
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(refresh, 0);
    const id = setInterval(refresh, 8000);
    return () => {
      clearTimeout(t);
      clearInterval(id);
    };
  }, [saved, refresh]);

  function save() {
    localStorage.setItem("shortdesk.runner.host", host.trim());
    localStorage.setItem("shortdesk.runner.token", token.trim());
    setSaved(!!host.trim() && !!token.trim());
  }

  async function control(path: "/start" | "/stop") {
    setBusy(true);
    setError(null);
    try {
      await call(path, "POST");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-foreground">
        Control a <strong>24/7 funding-farm runner</strong> you host yourself
        (see <code>runner/README.md</code>). Deploy <code>runner/server.mjs</code>{" "}
        to Railway/Render/Fly with a <code>CONTROL_TOKEN</code>, then paste its
        URL + token below. Still paper — no real orders.
      </div>

      {/* connection settings */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="mb-2 text-sm font-semibold">Runner connection</h3>
        <label className="mb-2 block">
          <span className="text-[11px] text-muted">Runner URL</span>
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="https://your-farm.up.railway.app"
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="mb-2 block">
          <span className="text-[11px] text-muted">Control token</span>
          <input
            value={token}
            onChange={(e) => setToken(e.target.value)}
            type="password"
            placeholder="the CONTROL_TOKEN you set on the runner"
            className="mt-0.5 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={save}
            className="rounded-md border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
          >
            Save & connect
          </button>
          {saved && (
            <>
              <button
                onClick={() => control("/start")}
                disabled={busy}
                className="rounded-md bg-long px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Start
              </button>
              <button
                onClick={() => control("/stop")}
                disabled={busy}
                className="rounded-md bg-short px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              >
                Stop
              </button>
              <button
                onClick={refresh}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted hover:text-foreground"
              >
                Refresh
              </button>
            </>
          )}
        </div>
        {error && (
          <div className="mt-2 rounded-md border border-short/40 bg-short/10 px-2.5 py-1.5 text-xs text-short">
            {error}
          </div>
        )}
      </div>

      {/* live status */}
      {status && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Status"
              value={status.running ? "running" : "stopped"}
              cls={status.running ? "text-long" : "text-muted"}
            />
            <Stat label="Equity" value={fmtUsd(status.equity)} big />
            <Stat
              label="Net P&L"
              value={`${status.realized + status.unrealized >= 0 ? "+" : ""}${fmtUsd(
                status.realized + status.unrealized,
              )}`}
              cls={
                status.realized + status.unrealized >= 0
                  ? "text-long"
                  : "text-short"
              }
              big
            />
            <Stat label="Open" value={String(status.openCount)} />
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="mb-2 text-sm font-semibold">
              Open positions ({status.positions.length})
            </h3>
            {status.positions.length === 0 ? (
              <p className="py-3 text-center text-xs text-muted">
                {status.running ? "Waiting for high-funding markets…" : "Stopped."}
              </p>
            ) : (
              <div className="space-y-1 text-xs">
                {status.positions.map((p) => (
                  <div
                    key={p.coin}
                    className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5"
                  >
                    <span className="font-medium">{p.coin}</span>
                    <span className="tabular text-muted">
                      now {fmtPct(p.currentApr, 0)} APR
                    </span>
                    <span className="tabular text-long">
                      +${p.accruedFunding.toFixed(3)}
                    </span>
                    <span className="tabular text-muted">
                      {p.ageHours < 1
                        ? `${Math.round(p.ageHours * 60)}m`
                        : `${p.ageHours.toFixed(1)}h`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
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
      <div className={`tabular font-semibold ${big ? "text-lg" : "text-sm"} ${cls ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
