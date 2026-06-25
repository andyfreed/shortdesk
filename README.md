# ShortDesk — learn to short crypto with leverage on Hyperliquid

An educational trading terminal for understanding how to **short cryptocurrencies with leverage** on [Hyperliquid](https://hyperliquid.xyz). It pulls **real, live** market data, explains **every setting in plain English**, shows you a **live liquidation-price + PnL calculator** before you risk anything, and can place **real short orders** signed entirely in your browser.

> ⚠️ **Not financial advice.** Leveraged shorting can lose more than your initial margin and a short's loss is theoretically unbounded. This project is for education. You are solely responsible for any trades you place.

## Features

- **Live markets dashboard** — real prices, 24h change, funding rates (annualized) and volume for every Hyperliquid perp, sortable and searchable.
- **Beginner guide** (`/learn`) — shorting, leverage, cross vs isolated margin, liquidation, funding, order types, fees, risk management, plus a worked example.
- **Short terminal** (`/trade`) — short-focused order form with the full option set, each with an inline **"?" explainer**:
  - margin mode (isolated/cross), leverage slider, market/limit order type, **time-in-force** (GTC/IOC/ALO post-only), size in USD/coin or **% of balance**, slippage, **reduce-only**;
  - attach a **take-profit and stop-loss** on entry (whole-position protection);
  - a **live calculator**: notional, required margin, **liquidation price + distance**, fees, funding/8h, a ±5%/±10% PnL scenario grid, and a **margin-vs-balance** guard.
- **Close positions** — full or **partial (25/50/75/100%)** close buttons on each open position (reduce-only buy-back).
- **Live trading** — connect a wallet and place real shorts. Two safe connection modes (below).
- **Clear onboarding** — explains agent-key vs account address, Perps vs Spot balances, and empty/funding states (the things beginners trip on).
- **Testnet toggle** — practice with fake money first (with faucet link).

## Why this is safe to deploy publicly

This is a **client-side-only** app. There is **no backend that ever sees a private key**:

- Market data uses Hyperliquid's public Info API (no auth).
- Orders are signed **in your browser** and sent straight to Hyperliquid's Exchange API.
- Vercel only serves the static frontend — **no secret ever touches the server**, which is exactly why Vercel is a fine host even for live mainnet trading. (Vercel is *not* suited to running a persistent trading **bot** or holding a key server-side — that's not what this does.)

### Two ways to connect

1. **Agent / API wallet (recommended).** In Hyperliquid: **More → API → Generate**. This key can **place orders but cannot withdraw funds**, so even a leak can't move your money. You also enter your main account address (the one you deposited to) so the app can read your balance and positions. The key is held **in memory only** — never written to disk, never sent anywhere except as a signature to Hyperliquid, and forgotten on reload.
2. **Browser wallet (MetaMask / Rabby).** Each order opens a signature prompt; the key never leaves your wallet extension.

## Getting started (local)

```bash
npm install
npm run dev
# open http://localhost:3000
```

No environment variables are required. To place live trades you need a funded
Hyperliquid account (deposit USDC on Arbitrum at app.hyperliquid.xyz) and either
an agent key or a browser wallet.

## Tech

- [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS
- [`@nktkas/hyperliquid`](https://github.com/nktkas/hyperliquid) — Hyperliquid TS SDK
- [`viem`](https://viem.sh) — wallet + EIP-712 signing

### Project layout

```
src/
  app/            # routes: / (markets), /learn, /trade
  components/     # Nav, MarketsDashboard, TradeTerminal, WalletPanel, Info
  lib/
    hyperliquid.ts  # info + exchange clients, market data, placeShort, setLeverage
    calc.ts         # liquidation price, PnL, fees, funding (pure, documented math)
    content.ts      # the plain-English explanations (guide + tooltips share them)
    wallet.tsx      # browser/agent wallet context (keys stay in the browser)
    network.tsx     # mainnet/testnet toggle
    format.ts       # number + Hyperliquid price/size rounding helpers
```

## Deploy to Vercel

The repo is a standard Next.js app and deploys with zero configuration.

1. Push to GitHub (already done if you cloned this).
2. Go to [vercel.com/new](https://vercel.com/new) and **Import** the repository.
3. Framework preset: **Next.js** (auto-detected). No env vars needed. Click **Deploy**.

Or with the CLI:

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

## Disclaimer

ShortDesk is provided as-is for educational purposes, with no warranty. It is
not affiliated with Hyperliquid. Trading leveraged perpetuals is risky; never
trade with money you cannot afford to lose.
