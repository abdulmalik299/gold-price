# Live Gold Price Chart — Luxury Dashboard

A production-ready **Vite + TypeScript** web app with:
- Live XAU ounce price (USD) from Gold API
- Persistent gain/loss badges (▲ green / ▼ red) that **do not reset** when price stays the same
- Karat pricing (24k/22k/21k/18k) with **mithqal or gram** toggle  
- Optional **USD→IQD** conversion (affects **karats only**, never the live ounce)
- Margin slider (0 → 70,000 IQD, step 1,000) for karats + a separate slider for expectation
- Expectation calculator (choose karat + unit, provide future ounce + FX)
- Tax/Margin solver (reverse-calc local jeweler margin and sync main slider)
- Real connection indicator (online/offline + signal + RTT ms + download kbps)
- Advanced Samsung-style calculator (no `eval`, supports ÷, ×, %, parentheses, trig, log, ln, sqrt, power) with show/hide history
- High-performance **history chart** (TradingView Lightweight Charts) with:
  - Grid, hover crosshair, zoom via wheel, pan via drag
  - Timeframe buttons: 24h / 7d / months / years
  - Data resampling in a **Web Worker** for smoothness
- PWA (installable on Android as an app)

---

## 1) Run locally

```bash
npm install
npm run dev
```

Build:

```bash
npm run build
npm run preview
```

---

## 2) Gold API

This project uses:

- `https://api.gold-api.com/price/XAU`

Example response (Feb 3, 2026): includes `price` and `updatedAt`.  
Source: Gold API live endpoint.

---

## 3) Supabase: chart history storage (works even when website is closed)

### 3.1 Create the table

Run:

- `supabase/migrations/001_create_gold_prices.sql`

### 3.2 Deploy the Edge Function

Function name: `gold-poller`  
Source code:

- `supabase/functions/gold-poller/index.ts`

Set secrets in Supabase Dashboard:

- `SUPABASE_URL` = your project URL
- `SUPABASE_SERVICE_ROLE_KEY` = service role key (never commit this to GitHub)
- Optional: `GOLD_API_URL`

Deploy (CLI):

```bash
supabase functions deploy gold-poller
```

### 3.3 Schedule it (Supabase Cron)

Supabase supports cron-style scheduling that can invoke Edge Functions.  
You can schedule `gold-poller` every minute, for example.

One safe pattern is a DB cron job that calls the Edge Function URL (requires `pg_cron` and `pg_net`):
- Create a secret header with your function key if needed.
- Or set `verify_jwt = false` (already set in `supabase/config.toml`).

> See Supabase Cron docs and Edge Function scheduling guides.

---

## 4) Android install (APK)

### Recommended (no APK): PWA install
Open the site in Chrome on Android → menu → **Install app**.

### If you need a real APK (Trusted Web Activity)
Use **Bubblewrap** to package this PWA:

1. Deploy your site (HTTPS) (Vercel/Netlify/etc.).
2. Install Bubblewrap:
   ```bash
   npm i -g @bubblewrap/cli
   ```
3. Initialize:
   ```bash
   bubblewrap init --manifest https://YOUR_DOMAIN/manifest.webmanifest
   ```
4. Build:
   ```bash
   bubblewrap build
   ```
This produces an Android APK/AAB.

---

## 5) Notes

- Live ounce is always USD and never converted.
- If USD→IQD is filled, **karat prices and gain/loss values** are converted, but the percent stays the same.
- Margin slider applies only in IQD mode; it is disabled in USD mode.
- History is inserted only when the price changes.

Enjoy.
