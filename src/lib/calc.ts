/**
 * Trading math for shorts. Everything here is pure and unit-tested by eye in
 * the comments so the UI can explain *why* a number is what it is.
 *
 * Conventions:
 *  - A SHORT profits when price falls and loses when price rises.
 *  - `size` is always the position size in base-asset units (e.g. BTC), > 0.
 *  - `leverage` is the chosen leverage multiple (e.g. 10 means 10x).
 */

export const DEFAULT_TAKER_FEE = 0.00045; // 0.045% — market orders
export const DEFAULT_MAKER_FEE = 0.00015; // 0.015% — resting limit (ALO) orders

/**
 * Maintenance margin fraction. Hyperliquid sets this to half the initial
 * margin required at the asset's max leverage:  mmr = 1 / (2 * maxLeverage).
 * So a 50x asset has a 1% maintenance margin; a 3x asset has ~16.7%.
 */
export function maintenanceMarginFraction(maxLeverage: number): number {
  if (!maxLeverage || maxLeverage <= 0) return 0;
  return 1 / (2 * maxLeverage);
}

export interface ShortInputs {
  entryPrice: number;
  /** Position size in base units. */
  size: number;
  leverage: number;
  maxLeverage: number;
}

/** Notional value of the position in USD: price * size. */
export function notional(entryPrice: number, size: number): number {
  return entryPrice * size;
}

/** Initial margin you must post = notional / leverage. */
export function initialMargin(
  entryPrice: number,
  size: number,
  leverage: number,
): number {
  if (leverage <= 0) return 0;
  return notional(entryPrice, size) / leverage;
}

/**
 * Liquidation price for a SHORT, isolated margin.
 *
 * Derivation: you are liquidated when your equity falls to the maintenance
 * margin. For a short:
 *    equity(P)            = margin + size * (entry - P)
 *    maintenanceRequired  = mmr * P * size
 * Set equal and solve for P:
 *    P_liq = (margin + size * entry) / (size * (1 + mmr))
 *
 * With mmr = 0 this reduces to entry * (1 + 1/leverage): a 10x short
 * liquidates ~10% above entry, which matches intuition.
 */
export function shortLiquidationPrice(inp: ShortInputs): number {
  const { entryPrice, size, leverage, maxLeverage } = inp;
  if (size <= 0 || leverage <= 0) return NaN;
  const margin = initialMargin(entryPrice, size, leverage);
  const mmr = maintenanceMarginFraction(maxLeverage);
  return (margin + size * entryPrice) / (size * (1 + mmr));
}

/** Long version, provided for comparison in the UI. */
export function longLiquidationPrice(inp: ShortInputs): number {
  const { entryPrice, size, leverage, maxLeverage } = inp;
  if (size <= 0 || leverage <= 0) return NaN;
  const margin = initialMargin(entryPrice, size, leverage);
  const mmr = maintenanceMarginFraction(maxLeverage);
  return (size * entryPrice - margin) / (size * (1 - mmr));
}

/** How far (%) price must move against a short before liquidation. */
export function distanceToLiquidationPct(
  entryPrice: number,
  liqPrice: number,
): number {
  if (!Number.isFinite(liqPrice) || entryPrice <= 0) return NaN;
  return ((liqPrice - entryPrice) / entryPrice) * 100;
}

/** Unrealized PnL for a short at a given mark price. */
export function shortPnl(
  entryPrice: number,
  markPrice: number,
  size: number,
): number {
  return size * (entryPrice - markPrice);
}

/** PnL as a % of the margin you posted (this is your real ROE). */
export function shortRoePct(
  inp: ShortInputs,
  markPrice: number,
): number {
  const margin = initialMargin(inp.entryPrice, inp.size, inp.leverage);
  if (margin <= 0) return NaN;
  return (shortPnl(inp.entryPrice, markPrice, inp.size) / margin) * 100;
}

/** Trading fee for one side of the trade. */
export function fee(
  entryPrice: number,
  size: number,
  feeRate: number,
): number {
  return notional(entryPrice, size) * feeRate;
}

/**
 * Funding for a SHORT over a number of hours.
 * `hourlyRate` is the per-hour funding rate fraction from the API.
 * When funding is positive, longs pay shorts, so a short *receives* funding
 * (positive number). When negative, the short pays.
 */
export function shortFunding(
  entryPrice: number,
  size: number,
  hourlyRate: number,
  hours: number,
): number {
  return notional(entryPrice, size) * hourlyRate * hours;
}

/** Size (base units) implied by a USD margin amount at a given leverage. */
export function sizeFromMargin(
  marginUsd: number,
  entryPrice: number,
  leverage: number,
): number {
  if (entryPrice <= 0) return 0;
  return (marginUsd * leverage) / entryPrice;
}

export interface ShortSummary {
  notional: number;
  margin: number;
  liqPrice: number;
  liqDistancePct: number;
  mmr: number;
  entryFee: number;
  exitFee: number;
  /** funding over 8h at the current rate, from the short's perspective */
  funding8h: number;
}

export function summarizeShort(
  inp: ShortInputs,
  opts: {
    feeRate?: number;
    hourlyFundingRate?: number;
    /** price assumed for the exit-fee estimate (defaults to entry) */
    exitPrice?: number;
  } = {},
): ShortSummary {
  const feeRate = opts.feeRate ?? DEFAULT_TAKER_FEE;
  const liqPrice = shortLiquidationPrice(inp);
  // Exit fee is charged on the notional at the exit price, not entry.
  const exitPrice = opts.exitPrice ?? inp.entryPrice;
  return {
    notional: notional(inp.entryPrice, inp.size),
    margin: initialMargin(inp.entryPrice, inp.size, inp.leverage),
    liqPrice,
    liqDistancePct: distanceToLiquidationPct(inp.entryPrice, liqPrice),
    mmr: maintenanceMarginFraction(inp.maxLeverage),
    entryFee: fee(inp.entryPrice, inp.size, feeRate),
    exitFee: fee(exitPrice, inp.size, feeRate),
    funding8h: shortFunding(
      inp.entryPrice,
      inp.size,
      opts.hourlyFundingRate ?? 0,
      8,
    ),
  };
}
