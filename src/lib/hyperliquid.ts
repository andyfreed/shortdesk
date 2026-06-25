/**
 * Thin wrapper around the Hyperliquid SDK.
 *
 * IMPORTANT: every call here runs in the browser. Read-only market data uses
 * the public Info API (no auth). Trading uses the Exchange API and signs with
 * a wallet that lives ONLY in the user's browser — no key is ever sent to a
 * server we control. That is what makes this safe to deploy on Vercel.
 */
import {
  HttpTransport,
  InfoClient,
  ExchangeClient,
} from "@nktkas/hyperliquid";
import type { Account, WalletClient } from "viem";
import { floorSize, priceToWire, sizeToWire } from "./format";

/** Either a viem local account (agent key) or a browser wallet client. */
export type HlSigner = Account | WalletClient;

export type Network = "mainnet" | "testnet";

const MAINNET_API = "https://api.hyperliquid.xyz";
const TESTNET_API = "https://api.hyperliquid-testnet.xyz";

export function apiUrl(network: Network): string {
  return network === "testnet" ? TESTNET_API : MAINNET_API;
}

function transport(network: Network) {
  return new HttpTransport({ isTestnet: network === "testnet" });
}

export function infoClient(network: Network): InfoClient {
  return new InfoClient({ transport: transport(network) });
}

export function exchangeClient(
  network: Network,
  wallet: HlSigner,
): ExchangeClient {
  // The SDK accepts a viem Account, a viem WalletClient, or an ethers Wallet.
  return new ExchangeClient({
    transport: transport(network),
    wallet: wallet as never,
    isTestnet: network === "testnet",
  });
}

// ---- Market data shapes the UI cares about ----

export interface Market {
  /** Asset index — this is the `a` field required when placing an order. */
  assetId: number;
  name: string;
  szDecimals: number;
  maxLeverage: number;
  markPx: number;
  midPx: number | null;
  oraclePx: number | null;
  prevDayPx: number | null;
  /** per-hour funding rate fraction */
  funding: number;
  openInterest: number;
  dayVolumeUsd: number;
  change24hPct: number | null;
}

/**
 * Fetch all perpetual markets with their live context (price, funding, etc).
 * Uses `metaAndAssetCtxs`, which returns [meta, assetCtxs] aligned by index.
 */
export async function fetchMarkets(network: Network): Promise<Market[]> {
  const info = infoClient(network);
  const [meta, ctxs] = await info.metaAndAssetCtxs();

  return meta.universe
    .map((u, i): Market | null => {
      const ctx = ctxs[i];
      if (!ctx) return null;
      const markPx = num(ctx.markPx);
      const prevDayPx = num(ctx.prevDayPx);
      const change =
        prevDayPx && prevDayPx > 0
          ? ((markPx - prevDayPx) / prevDayPx) * 100
          : null;
      return {
        assetId: i,
        name: u.name,
        szDecimals: u.szDecimals,
        maxLeverage: u.maxLeverage,
        markPx,
        midPx: ctx.midPx != null ? num(ctx.midPx) : null,
        oraclePx: ctx.oraclePx != null ? num(ctx.oraclePx) : null,
        prevDayPx,
        funding: num(ctx.funding),
        openInterest: num(ctx.openInterest) * markPx,
        dayVolumeUsd: num(ctx.dayNtlVlm),
        change24hPct: change,
      };
    })
    .filter((m): m is Market => m !== null && !u_isDelisted(m));
}

function u_isDelisted(m: Market): boolean {
  return m.markPx <= 0 || m.maxLeverage <= 0;
}

export async function fetchMarket(
  network: Network,
  name: string,
): Promise<Market | undefined> {
  const all = await fetchMarkets(network);
  return all.find((m) => m.name.toLowerCase() === name.toLowerCase());
}

// ---- Account state ----

export interface AccountSummary {
  accountValue: number;
  totalMarginUsed: number;
  withdrawable: number;
  /** USDC sitting in the Spot wallet — must be moved to Perps to short with. */
  spotUsdc: number;
  positions: OpenPosition[];
}

export interface OpenPosition {
  coin: string;
  szi: number; // signed size: negative = short
  entryPx: number | null;
  positionValue: number;
  unrealizedPnl: number;
  leverage: number;
  liquidationPx: number | null;
  marginUsed: number;
}

export async function fetchAccount(
  network: Network,
  address: `0x${string}`,
): Promise<AccountSummary> {
  const info = infoClient(network);
  const [s, spot] = await Promise.all([
    info.clearinghouseState({ user: address }),
    info
      .spotClearinghouseState({ user: address })
      .catch(() => ({ balances: [] as { coin: string; total: string }[] })),
  ]);
  const usdc = spot.balances.find((b) => b.coin === "USDC");
  return {
    accountValue: num(s.marginSummary.accountValue),
    totalMarginUsed: num(s.marginSummary.totalMarginUsed),
    withdrawable: num(s.withdrawable),
    spotUsdc: usdc ? num(usdc.total) : 0,
    positions: s.assetPositions.map((p) => {
      const pos = p.position;
      return {
        coin: pos.coin,
        szi: num(pos.szi),
        entryPx: pos.entryPx != null ? num(pos.entryPx) : null,
        positionValue: num(pos.positionValue),
        unrealizedPnl: num(pos.unrealizedPnl),
        leverage: pos.leverage ? num(pos.leverage.value) : 0,
        liquidationPx:
          pos.liquidationPx != null ? num(pos.liquidationPx) : null,
        marginUsed: num(pos.marginUsed),
      };
    }),
  };
}

// ---- Trading actions ----

export type OrderType = "market" | "limit";
/** Time-in-force for limit orders. */
export type Tif = "Gtc" | "Ioc" | "Alo";

export interface PlaceShortParams {
  network: Network;
  wallet: HlSigner;
  market: Market;
  /** size in base units */
  size: number;
  orderType: OrderType;
  /** required for limit orders */
  limitPrice?: number;
  /** for market orders, how much slippage to allow (e.g. 0.05 = 5%) */
  slippage?: number;
  /** time-in-force for limit orders (ignored for market, which is always IOC) */
  tif?: Tif;
  reduceOnly?: boolean;
  /** attach a take-profit: buy-to-close trigger when price FALLS to this */
  takeProfitPrice?: number;
  /** attach a stop-loss: buy-to-close trigger when price RISES to this */
  stopLossPrice?: number;
}

/**
 * Set the leverage + margin mode for an asset. Must be done before (or it
 * carries over to) the order. `isCross=false` means isolated margin.
 */
export async function setLeverage(args: {
  network: Network;
  wallet: HlSigner;
  market: Market;
  leverage: number;
  isCross: boolean;
}) {
  const ex = exchangeClient(args.network, args.wallet);
  // Clamp to the asset's max so Hyperliquid never rejects the action.
  const leverage = Math.min(
    args.market.maxLeverage,
    Math.max(1, Math.floor(args.leverage)),
  );
  return ex.updateLeverage({
    asset: args.market.assetId,
    isCross: args.isCross,
    leverage,
  });
}

type WireOrder = {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t:
    | { limit: { tif: Tif } }
    | { trigger: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" } };
};

/**
 * Place a SHORT order (selling to open). For a market order we send an IOC
 * order at a price worse than mark by `slippage` so it crosses the book and
 * fills immediately, mirroring how the Hyperliquid frontend does "market".
 *
 * Optional take-profit / stop-loss are attached as reduce-only BUY trigger
 * orders in the same request (grouping = positionTpsl so they protect the
 * whole position).
 */
export async function placeShort(p: PlaceShortParams) {
  const ex = exchangeClient(p.network, p.wallet);
  const { szDecimals, markPx, assetId } = p.market;
  const sz = floorSize(p.size, szDecimals);
  if (sz <= 0) throw new Error("Size rounds to zero for this market.");
  const sizeStr = sizeToWire(sz, szDecimals);

  let priceStr: string;
  let tif: Tif;

  if (p.orderType === "market") {
    const slip = p.slippage ?? 0.05;
    // selling, so we accept a LOWER price; push below mark to guarantee a cross
    priceStr = priceToWire(markPx * (1 - slip), szDecimals);
    tif = "Ioc";
  } else {
    if (!p.limitPrice || p.limitPrice <= 0)
      throw new Error("Limit price required for a limit order.");
    priceStr = priceToWire(p.limitPrice, szDecimals);
    tif = p.tif ?? "Gtc";
  }

  const orders: WireOrder[] = [
    {
      a: assetId,
      b: false, // false = short / sell
      p: priceStr,
      s: sizeStr,
      r: p.reduceOnly ?? false,
      t: { limit: { tif } },
    },
  ];

  // TP / SL close a short by BUYING back, so they are reduce-only buys.
  if (p.takeProfitPrice && p.takeProfitPrice > 0) {
    orders.push({
      a: assetId,
      b: true,
      p: priceToWire(p.takeProfitPrice, szDecimals),
      s: sizeStr,
      r: true,
      t: {
        trigger: {
          isMarket: true,
          triggerPx: priceToWire(p.takeProfitPrice, szDecimals),
          tpsl: "tp",
        },
      },
    });
  }
  if (p.stopLossPrice && p.stopLossPrice > 0) {
    orders.push({
      a: assetId,
      b: true,
      p: priceToWire(p.stopLossPrice, szDecimals),
      s: sizeStr,
      r: true,
      t: {
        trigger: {
          isMarket: true,
          triggerPx: priceToWire(p.stopLossPrice, szDecimals),
          tpsl: "sl",
        },
      },
    });
  }

  const hasTpSl = orders.length > 1;
  return ex.order({
    orders,
    grouping: hasTpSl ? "positionTpsl" : "na",
  });
}

/**
 * Close (or partially close) a SHORT by buying back. Reduce-only so it can
 * only shrink the position, never flip it long. Uses an aggressive IOC price
 * ABOVE mark (a buy must accept a higher price — the inverse of opening).
 */
export async function closeShort(args: {
  network: Network;
  wallet: HlSigner;
  market: Market;
  /** size in base units to buy back (already the amount to close) */
  size: number;
  slippage?: number;
}) {
  const ex = exchangeClient(args.network, args.wallet);
  const { szDecimals, markPx, assetId } = args.market;
  const sz = floorSize(args.size, szDecimals);
  if (sz <= 0) throw new Error("Nothing to close for this market.");
  const slip = args.slippage ?? 0.05;
  return ex.order({
    orders: [
      {
        a: assetId,
        b: true, // buy to close a short
        p: priceToWire(markPx * (1 + slip), szDecimals),
        s: sizeToWire(sz, szDecimals),
        r: true, // reduce-only
        t: { limit: { tif: "Ioc" } },
      },
    ],
    grouping: "na",
  });
}

function num(x: unknown): number {
  const n = typeof x === "string" ? parseFloat(x) : (x as number);
  return Number.isFinite(n) ? n : 0;
}
