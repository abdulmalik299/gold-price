# Live Gold Price Dashboard (Luxury)

A production-ready Vite + React + TypeScript project designed for **GitHub Pages**.

## What this includes

- Live **XAU (gold ounce)** price from `https://api.gold-api.com/price/XAU`
- Persistent **gain/loss badges** (amount + %) with red/green arrows
- Karat pricing: **24k / 22k / 21k / 18k**
  - Default **USD**
  - Optional **USD → IQD** conversion (affects karats only; ounce stays USD)
  - Supports **mithqal (5g)** and **gram**
- **Margin (tax) slider** for karats in IQD only (0 → 70,000 step 1,000)
- **Expectation** calculator with its own margin slider
- **Margin solver**: input (ounce, USD→IQD, local 21k per mithqal) → auto-compute margin + sync main slider
- **Connection status**: online/offline, latency (ms), estimated downlink (kbps)
- **Advanced calculator** with Samsung-style layout + history (÷ symbol)
- **PWA install** (Add to Home Screen). Optional Android APK via TWA wrap.
- **Supabase history chart**
  - Line chart with crosshair “+ ruler”, hover price readout, zoom & pan
  - 24H / 7D / Months / Years range buttons
  - History is stored by a Supabase Edge Function `gold-poller` that inserts only when the ounce price changes.

## Run locally

```bash
npm install
npm run dev
```
### Feedback form (Formspree)

Set the Formspree endpoint via `VITE_FORMSPREE_ENDPOINT` (see `.env.example`). The dashboard falls back to the default endpoint if the variable is not set.

## Build

```bash
npm run build
```

## Deploy to GitHub Pages

1. Create a GitHub repo.
2. Push this project.
3. In GitHub Actions, set env `VITE_BASE="/<repo-name>/"` before build.
4. (Optional) add `VITE_FORMSPREE_ENDPOINT` if you want to override the default Formspree endpoint.
5. Deploy `dist/` to Pages.

A sample workflow is included in `.github/workflows/deploy.yml`.

## Supabase setup

See `supabase/README.md` for:
- table SQL
- Edge Function code (`supabase/functions/gold-poller`)
- scheduling with `pg_cron` + `pg_net` (runs even when site is closed)

> Important: the dashboard can read history via the browser using the anon key, **but writes should be limited** to the Edge Function (RLS policies included).
