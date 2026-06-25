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
  accountModel: {
    title: "How your Hyperliquid account is split",
    short:
      "One account, two buckets: Perps (where shorts get their margin) and Spot. An agent key trades; it can't withdraw.",
    body: [
      "Your Hyperliquid account has separate balances. The Perps balance is the collateral that backs perpetual positions like shorts. The Spot balance holds tokens you've bought/deposited. They are not the same pot.",
      "You can trade with an 'agent' (API) key that signs orders on behalf of your main account but cannot move funds out — so it's safe to paste into an app. Withdrawals always require your real wallet.",
    ],
  },
  agentKey: {
    title: "Agent (API) key vs account address",
    short:
      "The address is your public account ID (42 chars). The agent key is a secret signing key (66 chars) that can trade but not withdraw.",
    body: [
      "Your account address is public — it's just the 0x identifier of your wallet (42 characters). It is not a secret.",
      "An agent/API key is a separate private key (0x + 64 hex = 66 characters) you generate under More → API on Hyperliquid. It can place and cancel orders for your account but cannot withdraw funds, which is exactly why it's the safe thing to give a trading app.",
      "In the connect form: the first box is your account address; the second box is the agent key. They both start with 0x but the key is about 24 characters longer.",
    ],
  },
  perpsVsSpot: {
    title: "Perps balance vs Spot balance",
    short:
      "Shorting can only use your Perps balance. USDC sitting in Spot must be moved to Perps first.",
    body: [
      "Perpetual positions (shorts and longs) draw margin from your Perps balance. If your USDC is in your Spot balance, you can't short with it until you transfer it.",
      "On Hyperliquid, use the Spot → Perps transfer (clearest on the desktop site). With a Unified account, placing a trade can also draw from your single balance automatically.",
    ],
  },
  notionalHelp: {
    title: "Notional value",
    short:
      "The full dollar size of the position you control. Your margin is a fraction of it (notional ÷ leverage).",
    body: [
      "Notional = size × price. It's the total value of what you're shorting, not what you put up. At 5x leverage a $500 notional needs $100 of margin.",
      "Your profit and loss are calculated on the notional, which is why leverage magnifies returns relative to the margin you posted.",
    ],
  },
  closePosition: {
    title: "Close position",
    short:
      "Buys back the coin you shorted to exit and realize your profit or loss. Partial close takes some risk off while keeping the rest.",
    body: [
      "A short is opened by selling; to close it you buy the same amount back. Closing realizes whatever PnL the position currently shows.",
      "A partial close (e.g. 50%) buys back half, locking in part of the result and leaving the rest of the position open. Closes are reduce-only, so they can never accidentally flip you into a long.",
    ],
  },
  takeProfit: {
    title: "Take-profit (TP)",
    short:
      "An order that auto-closes your short when the price FALLS to your target, locking in gains.",
    body: [
      "Because a short profits as price falls, a take-profit triggers below your entry. When the market reaches it, a buy-to-close fires automatically — you don't have to be watching.",
      "Set it where you'd be happy to bank the trade. It's optional and you can always close manually instead.",
    ],
  },
  stopLoss: {
    title: "Stop-loss (SL)",
    short:
      "An order that auto-closes your short when the price RISES to a level you pick, capping your loss.",
    body: [
      "A short loses as price rises, so a stop-loss sits above your entry. If the market hits it, a buy-to-close fires to stop the bleeding before you reach liquidation.",
      "A stop is your most important risk tool: decide the price that proves your trade wrong, and put the stop there when you open. Note that in fast markets a market-stop can fill slightly worse than its trigger.",
    ],
  },
  tpslGrouping: {
    title: "Whole-position protection",
    short:
      "TP/SL attached here apply to your entire position in this coin, not just this one order.",
    body: [
      "These take-profit and stop-loss orders are sent as 'position' TP/SL: they protect your whole short in this market and resize with it, rather than being tied to one specific entry.",
    ],
  },
  timeInForce: {
    title: "Time-in-force (GTC / IOC / ALO)",
    short:
      "How a limit order behaves: GTC rests until filled, IOC fills now or cancels, ALO is maker-only (cheaper fee).",
    body: [
      "GTC (Good-til-canceled): the order sits on the book until it fills or you cancel it.",
      "IOC (Immediate-or-cancel): fills whatever it can right away and cancels the rest — nothing rests.",
      "ALO (Add-liquidity-only / post-only): rejected if it would fill immediately, guaranteeing you pay the lower maker fee. Useful when you want to be a passive seller.",
    ],
  },
  percentSize: {
    title: "Size by % of balance",
    short:
      "Sizes the trade from your Perps balance instead of a dollar amount. Max uses your full buying power at the current leverage.",
    body: [
      "Instead of typing notional, pick a percentage of your available Perps balance. The app multiplies by your leverage to get the position size, so you can size consistently without doing the math.",
      "Be careful with Max: using 100% of your margin leaves no buffer, so any adverse move pushes you straight toward liquidation. Most traders keep some headroom.",
    ],
  },
  scaleOrder: {
    title: "Scale order (advanced)",
    short:
      "Splits your entry into several limit orders laddered across a price range for a better average fill.",
    body: [
      "Rather than one order at a single price, a scale order places multiple limits stepped across a range. If the market swings through your range you get a blended entry instead of all-in at one level.",
      "This is an advanced tool. You can build it on Hyperliquid's pro interface; ShortDesk keeps the entry simple for learning.",
    ],
  },
  twap: {
    title: "TWAP order (advanced)",
    short:
      "Breaks a large order into small slices executed steadily over minutes to get an average price.",
    body: [
      "TWAP (time-weighted average price) drips a big position into the market over time so one large trade doesn't move the price against you. It mostly matters for large size.",
      "It's available on Hyperliquid directly; for beginner-sized shorts a market or limit order is simpler and fine.",
    ],
  },
} satisfies Record<string, Explainer>;

export type ExplainerKey = keyof typeof EXPLAINERS;

export const SHORTING_STEPS = [
  {
    n: 1,
    title: "Fund your account (and check Perps, not Spot)",
    text: "Deposit USDC to Hyperliquid (on Arbitrum). Then make sure it's in your Perps balance — shorting can only use Perps funds. If your money shows under Spot, transfer it Spot → Perps first.",
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
