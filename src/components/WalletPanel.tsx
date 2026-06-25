"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useNetwork } from "@/lib/network";
import { fetchAccount, type AccountSummary } from "@/lib/hyperliquid";
import { fmtUsd, fmtNum } from "@/lib/format";

export function WalletPanel() {
  const w = useWallet();
  const { network } = useNetwork();
  const [tab, setTab] = useState<"agent" | "browser">("agent");
  const [key, setKey] = useState("");
  const [master, setMaster] = useState("");
  const [remember, setRemember] = useState(true);
  const [account, setAccount] = useState<AccountSummary | null>(null);

  // Pre-fill the address field with whatever was saved last time.
  useEffect(() => {
    if (w.address) setMaster((m) => m || w.address!);
  }, [w.address]);

  // Pull live account state when connected (or when an address is remembered).
  useEffect(() => {
    if (!w.address) {
      setAccount(null);
      return;
    }
    let active = true;
    const load = () =>
      fetchAccount(network, w.address!)
        .then((a) => active && setAccount(a))
        .catch(() => active && setAccount(null));
    load();
    const id = setInterval(load, 6000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [w.address, network]);

  if (w.signer) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-muted">
              Connected · {w.mode === "agent" ? "Agent key" : "Browser wallet"}
            </div>
            <div className="tabular text-sm">
              {w.address?.slice(0, 6)}…{w.address?.slice(-4)}
            </div>
          </div>
          <button
            onClick={w.disconnect}
            className="rounded-md border border-border px-2.5 py-1 text-xs text-muted hover:text-foreground"
          >
            Disconnect
          </button>
        </div>
        {account && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <Stat
              label="Perps (tradeable)"
              value={fmtUsd(account.accountValue)}
            />
            <Stat label="Spot" value={fmtUsd(account.spotUsdc)} />
          </div>
        )}
        {account &&
          account.accountValue < 0.01 &&
          account.spotUsdc >= 0.01 && (
            <div className="mt-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
              You have {fmtUsd(account.spotUsdc)} in <strong>Spot</strong> but{" "}
              <strong>$0 in Perps</strong>. Shorting uses your Perps balance —
              transfer USDC from Spot → Perps on{" "}
              <a
                href="https://app.hyperliquid.xyz"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                app.hyperliquid.xyz
              </a>{" "}
              and it’ll appear here within seconds.
            </div>
          )}
        {account && account.positions.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-muted">Open positions</div>
            <div className="space-y-1">
              {account.positions.map((p) => (
                <div
                  key={p.coin}
                  className="flex items-center justify-between rounded-md bg-surface-2 px-2.5 py-1.5 text-xs"
                >
                  <span className="font-medium">
                    {p.coin}{" "}
                    <span className={p.szi < 0 ? "text-short" : "text-long"}>
                      {p.szi < 0 ? "SHORT" : "LONG"}
                    </span>
                  </span>
                  <span className="tabular text-muted">
                    {fmtNum(Math.abs(p.szi))} @ {fmtUsd(p.entryPx)}
                  </span>
                  <span
                    className={`tabular ${
                      p.unrealizedPnl >= 0 ? "text-long" : "text-short"
                    }`}
                  >
                    {fmtUsd(p.unrealizedPnl)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">Connect to trade live</h3>
      <p className="mt-1 text-xs text-muted">
        Keys stay in your browser and are sent only to Hyperliquid. We never see
        them.
      </p>

      <div className="mt-3 inline-flex rounded-lg border border-border p-0.5 text-xs">
        {(["agent", "browser"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1 capitalize ${
              tab === t ? "bg-surface-2 text-foreground" : "text-muted"
            }`}
          >
            {t === "agent" ? "Agent key" : "Browser wallet"}
          </button>
        ))}
      </div>

      {tab === "agent" ? (
        <div className="mt-3 space-y-2">
          <p className="rounded-md bg-surface-2 p-2 text-xs text-muted">
            Recommended. In Hyperliquid: <strong>More → API</strong> → generate
            a wallet. Agent keys can trade but <strong>cannot withdraw</strong>.
            Sent only to Hyperliquid, never to our servers.
          </p>
          <input
            value={master}
            onChange={(e) => setMaster(e.target.value)}
            placeholder="Main account address (0x… you deposited to)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            placeholder="Agent private key (0x…)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <label className="flex cursor-pointer items-start gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="mt-0.5 accent-accent"
            />
            <span>
              Stay connected on this device (saves the agent key in this
              browser). Only do this on a device you trust — the key can trade
              but cannot withdraw your funds.
            </span>
          </label>
          <button
            onClick={() => w.connectAgent(key, master, remember)}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Connect agent
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="rounded-md bg-surface-2 p-2 text-xs text-muted">
            Connect MetaMask / Rabby. Each order opens a signature prompt; your
            key never leaves the wallet.
          </p>
          <button
            onClick={w.connectBrowser}
            disabled={w.connecting}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {w.connecting ? "Connecting…" : "Connect browser wallet"}
          </button>
        </div>
      )}

      {w.error && (
        <div className="mt-2 rounded-md border border-short/40 bg-short/10 px-2.5 py-1.5 text-xs text-short">
          {w.error}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-1.5">
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular text-sm">{value}</div>
    </div>
  );
}
