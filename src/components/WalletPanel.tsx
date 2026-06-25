"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet";
import { useNetwork } from "@/lib/network";
import { closeShort, type AccountSummary, type Market } from "@/lib/hyperliquid";
import { fmtUsd, fmtNum } from "@/lib/format";
import { Info } from "@/components/Info";

export function WalletPanel({
  account,
  stale,
  markets,
  onChanged,
}: {
  account: AccountSummary | null;
  stale?: boolean;
  markets: Market[];
  onChanged?: () => void;
}) {
  const w = useWallet();
  const [tab, setTab] = useState<"agent" | "browser">("agent");
  const [key, setKey] = useState("");
  // Pre-fill the address from the value saved last time (lint-clean, no effect).
  const [master, setMaster] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("shortdesk.master") ?? ""
      : "",
  );
  const [remember, setRemember] = useState(true);
  const [swapWarn, setSwapWarn] = useState(false);

  if (w.signer) {
    return (
      <ConnectedView
        account={account}
        stale={stale}
        markets={markets}
        onChanged={onChanged}
      />
    );
  }

  const keyLen = key.trim().replace(/^0x/, "").length;
  const masterLen = master.trim().replace(/^0x/, "").length;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-1.5">
        <h3 className="text-sm font-semibold">Connect to trade live</h3>
        <Info k="agentKey" />
      </div>
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
        <div className="mt-3 space-y-3">
          <ol className="space-y-0.5 rounded-md bg-surface-2 p-2 text-xs text-muted">
            <li>1. On Hyperliquid open <strong>More → API</strong>.</li>
            <li>2. Click <strong>Generate</strong> to create an API/agent wallet.</li>
            <li>
              3. Copy the <strong>private key</strong> it shows (a long 0x
              string) and authorize it.
            </li>
            <li>4. Paste both values below. The agent key can trade but{" "}
              <strong>cannot withdraw</strong>.</li>
          </ol>

          <div>
            <label className="text-xs font-medium">
              Step 1 — Your main account address
            </label>
            <input
              value={master}
              onChange={(e) => setMaster(e.target.value)}
              placeholder="0x… (the account you deposited USDC into)"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-0.5 text-[11px] text-muted">
              Public address, 42 characters. Not a secret.{" "}
              {master && (
                <span className={masterLen === 40 ? "text-long" : "text-warn"}>
                  ({master.trim().length} chars)
                </span>
              )}
            </p>
          </div>

          <div>
            <label className="text-xs font-medium">
              Step 2 — Agent (API) private key
            </label>
            <input
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setSwapWarn(false);
              }}
              onBlur={() => setSwapWarn(keyLen === 40)}
              type="password"
              placeholder="0x… (the secret key from More → API)"
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="mt-0.5 text-[11px] text-muted">
              Secret signing key, 66 characters.{" "}
              {key && (
                <span className={keyLen === 64 ? "text-long" : "text-warn"}>
                  ({key.trim().length} chars)
                </span>
              )}
            </p>
            {swapWarn && (
              <p className="mt-1 text-[11px] text-warn">
                That looks like an address, not a private key — did you swap the
                two fields?
              </p>
            )}
          </div>

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

function ConnectedView({
  account,
  stale,
  markets,
  onChanged,
}: {
  account: AccountSummary | null;
  stale?: boolean;
  markets: Market[];
  onChanged?: () => void;
}) {
  const w = useWallet();
  const { network } = useNetwork();
  const empty =
    account != null &&
    account.accountValue < 0.01 &&
    account.spotUsdc < 0.01;
  // Buying power on a unified account = free Perps margin + Spot USDC.
  const buyingPower = account
    ? account.withdrawable + account.spotUsdc
    : 0;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">
            {w.mode === "agent" ? "Main account · via agent key" : "Browser wallet"}
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
        <>
          <div className="mt-3 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2">
            <div className="flex items-center gap-1 text-[11px] text-muted">
              Buying power <Info k="perpsVsSpot" />
              {stale && <span className="text-warn">· may be out of date</span>}
            </div>
            <div className="tabular text-lg font-semibold">
              {fmtUsd(buyingPower)}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <Stat label="Perps (in positions)" value={fmtUsd(account.accountValue)} />
            <Stat label="Spot USDC" value={fmtUsd(account.spotUsdc)} />
          </div>
          <p className="mt-1 text-[11px] text-muted">
            On a unified account (Hyperliquid’s default) your Spot USDC margins
            shorts directly — both balances count toward buying power.
          </p>
        </>
      )}

      {empty && (
        <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
          This account has no USDC yet.{" "}
          {network === "testnet" ? (
            <>
              On testnet, get fake test USDC from the{" "}
              <a
                href="https://app.hyperliquid-testnet.xyz/drip"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                testnet faucet
              </a>{" "}
              to practice.
            </>
          ) : (
            <>
              Deposit USDC to Hyperliquid (Arbitrum) at{" "}
              <a
                href="https://app.hyperliquid.xyz"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                app.hyperliquid.xyz
              </a>{" "}
              before shorting.
            </>
          )}
        </div>
      )}

      {account && account.positions.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex items-center gap-1 text-xs text-muted">
            Open positions <Info k="closePosition" />
          </div>
          <div className="space-y-2">
            {account.positions.map((p) => (
              <PositionRow
                key={p.coin}
                coin={p.coin}
                szi={p.szi}
                entryPx={p.entryPx}
                pnl={p.unrealizedPnl}
                market={markets.find((m) => m.name === p.coin)}
                onChanged={onChanged}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PositionRow({
  coin,
  szi,
  entryPx,
  pnl,
  market,
  onChanged,
}: {
  coin: string;
  szi: number;
  entryPx: number | null;
  pnl: number;
  market?: Market;
  onChanged?: () => void;
}) {
  const w = useWallet();
  const { network } = useNetwork();
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const isShort = szi < 0;

  async function doClose(fraction: number) {
    if (!w.signer || !market) {
      setErr("Live market data still loading — try again in a second.");
      return;
    }
    setBusy(fraction);
    setErr(null);
    try {
      const size = Math.abs(szi) * fraction;
      await closeShort({ network, wallet: w.signer, market, size });
      onChanged?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Close failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-md bg-surface-2 px-2.5 py-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          {coin}{" "}
          <span className={isShort ? "text-short" : "text-long"}>
            {isShort ? "SHORT" : "LONG"}
          </span>
        </span>
        <span className="tabular text-muted">
          {fmtNum(Math.abs(szi))} @ {fmtUsd(entryPx)}
        </span>
        <span className={`tabular ${pnl >= 0 ? "text-long" : "text-short"}`}>
          {pnl >= 0 ? "+" : ""}
          {fmtUsd(pnl)}
        </span>
      </div>
      {isShort && (
        <div className="mt-2 flex items-center gap-1">
          <span className="mr-1 text-[10px] text-muted">Close:</span>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <button
              key={f}
              disabled={busy !== null}
              onClick={() => doClose(f)}
              className="flex-1 rounded border border-border py-1 text-[11px] hover:border-accent hover:text-accent disabled:opacity-50"
            >
              {busy === f ? "…" : f === 1 ? "100%" : `${f * 100}%`}
            </button>
          ))}
        </div>
      )}
      {err && <div className="mt-1 text-[11px] text-short">{err}</div>}
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
