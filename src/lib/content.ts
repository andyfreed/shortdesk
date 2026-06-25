/**
 * Plain-English explanations used both on the Learn page and as inline
 * tooltips next to each trade setting. Keeping them here means the wording on
 * the order form and the guide can never drift apart.
 */

export interface Explainer {
  title: string;
  /** one-liner shown in tooltips */
  short: string;
  /** fuller copy shown on the Learn page (paragraphs) */
  body: string[];
}

export const EXPLAINERS = {
  short: {
    title: "Shorting",
    short:
      "Betting a price will fall. You sell now to (hopefully) buy back cheaper later.",
    body: [
      "Shorting means you profit when the price goes DOWN. On a perpetual exchange like Hyperliquid you do this by opening a short position: you sell a contract you don't own, and your profit is the difference if you later buy it back at a lower price.",
      "Example: you short 1 BTC at $60,000. If BTC falls to $54,000 and you close, you make ~$6,000 (minus fees and funding). If BTC instead rises to $66,000, you lose ~$6,000.",
      "The danger that doesn't exist when buying: a price can rise without limit, so a short's theoretical loss is unbounded. Leverage makes that loss arrive much faster.",
    ],
  },
  leverage: {
    title: "Leverage",
    short:
      "A multiplier on your position size. 10x means $100 controls a $1,000 position — and 10x the risk.",
    body: [
      "Leverage lets you control a position larger than your cash (margin). At 10x, $100 of margin opens a $1,000 position. Your profits and losses are calculated on the full $1,000.",
      "The trade-off is brutal: at 10x, a 10% move against you wipes out your entire margin (liquidation). At 25x it only takes a ~4% move. Higher leverage = a liquidation price much closer to where you entered.",
      "Beginners should treat leverage as a risk dial, not a profit dial. Many experienced traders use 2x–5x. The maximum allowed varies per asset (3x–50x on Hyperliquid) and is shown on each market.",
    ],
  },
  marginMode: {
    title: "Margin mode: Cross vs Isolated",
    short:
      "Isolated risks only the margin on this trade. Cross uses your whole balance as backstop.",
    body: [
      "Isolated margin: only the margin you assigned to this position can be lost. If it gets liquidated, the rest of your account is untouched. Best for learning and for high-conviction single bets.",
      "Cross margin: your entire account balance backs the position. This pushes the liquidation price further away (harder to get liquidated), but a bad trade can drain your whole account. Useful for hedging, dangerous for beginners.",
      "Rule of thumb while learning: use Isolated so a single mistake can't blow up everything.",
    ],
  },
  liquidation: {
    title: "Liquidation price",
    short:
      "The price at which the exchange force-closes your position because your margin is exhausted.",
    body: [
      "If the market moves against you far enough that your remaining equity drops to the maintenance margin, the exchange automatically closes your position to stop your losses from going negative. This is liquidation, and you lose your posted margin.",
      "For a short, the liquidation price is ABOVE your entry (price rising hurts you). The higher your leverage, the closer this price sits to your entry — i.e. the smaller the move needed to wipe you out.",
      "Maintenance margin on Hyperliquid is half the initial margin at the asset's max leverage, roughly 1%–16.7% depending on the asset. The calculator on the trade screen shows your exact liquidation price and how far away it is.",
    ],
  },
  funding: {
    title: "Funding rate",
    short:
      "A periodic payment between longs and shorts that keeps the perp price near spot. Shorts often get paid.",
    body: [
      "Perpetual futures have no expiry, so funding payments tether the contract price to the underlying spot price. Funding is exchanged directly between traders (not the exchange), typically every hour on Hyperliquid.",
      "When funding is POSITIVE, longs pay shorts — so holding a short earns you funding. When NEGATIVE, shorts pay longs. The rate is small per hour but compounds: an annualized figure is shown so you can judge it.",
      "Funding is a real part of your P&L. A short held for days in a positive-funding market collects a steady stream; in a deeply negative market it bleeds you even if the price doesn't move.",
    ],
  },
  orderType: {
    title: "Order type: Market vs Limit",
    short:
      "Market fills now at the going price (taker). Limit waits for your price (often maker, lower fee).",
    body: [
      "Market order: executes immediately against existing orders. You're guaranteed a fill but not a price — in a fast or thin market you may get 'slippage'. Market orders pay the higher taker fee.",
      "Limit order: you set the price you're willing to sell at; it only fills at that price or better. It may not fill at all, but resting limit orders ('Add Liquidity Only') pay the lower maker fee.",
      "For shorting, a limit order placed slightly above the current price lets you enter on a bounce at a better price; a market order gets you in right now if you think the drop is starting.",
    ],
  },
  size: {
    title: "Position size",
    short:
      "How big the position is, in the coin's units. Combined with leverage it sets your required margin.",
    body: [
      "Size is measured in the base asset (e.g. 0.1 BTC, 5 ETH). Notional value = size × price. The margin you must post = notional ÷ leverage.",
      "Don't size by 'how much margin do I have' — size by 'how much am I willing to lose if I'm stopped out'. Decide your invalidation price first, then pick a size where hitting it costs an amount you can stomach.",
    ],
  },
  reduceOnly: {
    title: "Reduce-only",
    short:
      "An order that can only shrink or close a position, never flip it the other way.",
    body: [
      "A reduce-only order will never increase your exposure or open an opposite position. Use it when closing or partially closing so you can't accidentally go from short to long.",
      "Stop-loss and take-profit orders are normally reduce-only: they exist purely to close your position at a chosen level.",
    ],
  },
  slippage: {
    title: "Slippage tolerance",
    short:
      "The worst price you'll accept on a market order. Wider = surer fill, possibly worse price.",
    body: [
      "Because a market short sells into the order book, the average fill can be worse than the last price, especially for large size or thin books. Slippage tolerance caps how far the price can move before the order is rejected.",
      "This app sends market shorts as an immediate-or-cancel order priced below the mark by your tolerance, so you never fill at an absurd price during a wick.",
    ],
  },
} satisfies Record<string, Explainer>;

export type ExplainerKey = keyof typeof EXPLAINERS;

export const SHORTING_STEPS = [
  {
    n: 1,
    title: "Fund your account",
    text: "Deposit USDC to Hyperliquid (on Arbitrum). This collateral is the margin that backs your shorts.",
  },
  {
    n: 2,
    title: "Pick a market and a thesis",
    text: "Choose a coin you believe will fall, and decide the price that would prove you wrong (your invalidation).",
  },
  {
    n: 3,
    title: "Choose margin mode + leverage",
    text: "Start with Isolated margin and low leverage (2x–5x). This keeps the liquidation price far from entry and caps your downside to one position.",
  },
  {
    n: 4,
    title: "Size the position",
    text: "Pick a size so that being stopped out at your invalidation costs an amount you can accept — not the maximum the margin allows.",
  },
  {
    n: 5,
    title: "Place the short",
    text: "Sell to open with a market order (fills now) or a limit order (your price). Check the liquidation price BEFORE confirming.",
  },
  {
    n: 6,
    title: "Manage the trade",
    text: "Set a stop-loss to cap losses and a take-profit to lock gains. Watch funding — it adds up over time.",
  },
];

export const RISKS = [
  "Leveraged shorting can lose more than the cash you put in. Liquidation means losing 100% of a position's margin.",
  "A price can rise without limit, so a short's loss is theoretically unbounded.",
  "High leverage puts your liquidation price extremely close to entry — normal volatility can wipe you out.",
  "Funding can erode a position even when your price call is correct.",
  "Markets gap and wick; stop-losses are not guaranteed to fill at your exact price.",
  "Never trade with money you cannot afford to lose. This app is for education, not advice.",
];
