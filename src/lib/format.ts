/**
 * Number formatting + Hyperliquid-specific rounding helpers.
 *
 * Hyperliquid has two rounding rules that orders MUST follow or they are
 * rejected by the API:
 *
 *  - Sizes are rounded to `szDecimals` decimal places (per-asset, from `meta`).
 *  - Prices may have at most 5 significant figures, AND at most
 *    (6 - szDecimals) decimal places for perps. Integer prices are always allowed.
 *
 * See: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/tick-and-lot-size
 */

const MAX_SIG_FIGS = 5;
const PERP_MAX_DECIMALS = 6;

export function roundSize(size: number, szDecimals: number): number {
  const factor = 10 ** szDecimals;
  return Math.round(size * factor) / factor;
}

/** Round a price to a value Hyperliquid will accept for a perp asset. */
export function roundPrice(price: number, szDecimals: number): number {
  if (!Number.isFinite(price) || price <= 0) return price;

  // Integer prices are always allowed regardless of sig figs.
  if (Number.isInteger(price)) return price;

  const maxDecimals = PERP_MAX_DECIMALS - szDecimals;

  // 5 significant figures.
  const sigRounded = Number(price.toPrecision(MAX_SIG_FIGS));
  // Then clamp decimal places.
  const factor = 10 ** maxDecimals;
  return Math.round(sigRounded * factor) / factor;
}

/** A price string suitable for sending to the API (no trailing zeros, valid). */
export function priceToWire(price: number, szDecimals: number): string {
  return stripTrailingZeros(roundPrice(price, szDecimals));
}

export function sizeToWire(size: number, szDecimals: number): string {
  return roundSize(size, szDecimals).toFixed(szDecimals);
}

function stripTrailingZeros(n: number): string {
  return n.toFixed(8).replace(/\.?0+$/, "");
}

// ---- display helpers ----

export function fmtUsd(
  n: number | null | undefined,
  opts: { maxFrac?: number; minFrac?: number } = {},
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  // pick sensible precision based on magnitude
  const maxFrac =
    opts.maxFrac ?? (abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6);
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.minFrac ?? Math.min(2, maxFrac),
    maximumFractionDigits: maxFrac,
  });
}

export function fmtNum(
  n: number | null | undefined,
  maxFrac = 4,
): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

export function fmtPct(n: number | null | undefined, frac = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(frac)}%`;
}

/** Funding rate from the API is a per-hour fraction. Show as annualized %. */
export function annualizedFundingPct(hourlyRate: number): number {
  return hourlyRate * 24 * 365 * 100;
}

export function fmtCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}
