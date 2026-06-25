# ShortDesk 24/7 funding-farm runner

A standalone Node process that runs the **delta-neutral funding-farm paper
simulation** continuously — no browser required. It reads live Hyperliquid
funding rates, simulates shorting high-funding perps against an equal
offsetting long (price-neutral), accrues funding net of fees, and rotates out
as funding decays. State persists to a JSON file so it resumes after restarts.

> **Paper only.** This never places real orders — it's a simulator. Making it
> trade live would mean adding signed exchange calls and a funded agent key,
> which is deliberately not included.

## Run it locally

```bash
npm install            # if you haven't already (uses @nktkas/hyperliquid)
node runner/funding-farm-runner.mjs
```

You'll see lines like:

```
[..] OPEN  LIT @ 63% APR funding
[..] equity $999.40 | realized +$0.000 | open 5 | closed 0
```

Stop with `Ctrl+C`. State is saved to `farm-state.json` (gitignored) and
reloaded on the next start, so funding keeps accruing across restarts.

## Keep it alive on your own machine (pm2)

```bash
npm i -g pm2
pm2 start runner/funding-farm-runner.mjs --name farm
pm2 logs farm        # watch it
pm2 save             # persist across reboots
```

## Deploy to an always-on host (browser fully closed)

Any host that runs a long-lived Node process works. The simplest:

**Railway / Render / Fly.io**
1. Push this repo to GitHub (already done).
2. Create a new service from the repo.
3. Set the **start command** to:
   ```
   node runner/funding-farm-runner.mjs
   ```
4. (Optional) set env vars below. Deploy. It runs 24/7.

> Note: on ephemeral hosts the `farm-state.json` file may reset on redeploy.
> For durable state, point `STATE_PATH` at a mounted volume, or accept that a
> redeploy starts the paper account fresh.

## Control it from the web app (start/stop/status)

Instead of the bare CLI, run the **control server**, which exposes a tiny
token-protected HTTP API the app's **Bot → 24/7** tab talks to:

```bash
CONTROL_TOKEN=pick-a-long-secret node runner/server.mjs
```

Endpoints (all require `Authorization: Bearer <CONTROL_TOKEN>`):
`GET /status`, `POST /start`, `POST /stop`. CORS is open by default
(`ALLOW_ORIGIN=*`); set `ALLOW_ORIGIN` to your Vercel URL to lock it down.

**Deploy (Railway/Render/Fly):**
1. Start command: `node runner/server.mjs`
2. Env: `CONTROL_TOKEN=<secret>` (required), optionally `AUTOSTART=1`,
   `ALLOW_ORIGIN=https://your-app.vercel.app`, plus any farm config below.
3. Note the public URL it gets.

**In the app:** open **Bot → 24/7**, paste the runner URL + the same
`CONTROL_TOKEN`, hit **Save & connect**, then **Start** / **Stop**. Live status
(equity, open positions, funding collected) polls automatically.

Extra env for the server: `PORT` (default 8080), `CONTROL_TOKEN` (required),
`ALLOW_ORIGIN` (default `*`), `AUTOSTART` (`1` to run on boot).

## Configuration (env vars, all optional)

| Var | Default | Meaning |
|-----|---------|---------|
| `START_BALANCE` | `1000` | simulated starting paper capital |
| `SIZE_USD` | `200` | USD notional per leg of each delta-neutral position |
| `MAX_POSITIONS` | `5` | max simultaneous positions |
| `MIN_ENTRY_APR` | `10` | only open if funding ≥ this annualized % |
| `EXIT_APR` | `2` | close once funding drops below this % (or goes negative) |
| `MIN_VOLUME` | `5000000` | skip markets below this 24h USD volume |
| `FEE_RATE` | `0.00015` | per-fill fee (maker; use `0.00045` for taker) |
| `TICK_MS` | `30000` | loop interval in ms |
| `STATE_PATH` | `farm-state.json` | where to persist state |

Example:

```bash
SIZE_USD=100 MAX_POSITIONS=8 MIN_ENTRY_APR=15 node runner/funding-farm-runner.mjs
```
