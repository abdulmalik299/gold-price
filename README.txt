Aurum IQ — Luxury Gold Dashboard (Vanilla, no build tools)

Run:
- Just open index.html

Live API:
- https://api.gold-api.com/price/XAU

Supabase (optional but recommended for shared history):
1) Open config.js and paste your SUPABASE_ANON_KEY (Project Settings → API).
2) Create a table in Supabase SQL editor:

  create table if not exists gold_prices (
    t bigint primary key,
    p double precision not null
  );

3) Disable RLS or create a policy for insert/select with anon key:
   - For simple personal use: disable RLS on gold_prices.
   - For public use: create safe policies (rate-limit, etc).

Notes:
- The chart stores points ONLY when the live ounce price changes (noise filtered ≥ $0.10).
- Local cache is always used for fast start, even when Supabase is enabled.
- Margin slider applies ONLY in IQD mode (when USD→IQD is filled).

Android install:
- This is a PWA. Use Install button (or browser menu → Add to Home screen).
- To wrap as a true APK, use Android Trusted Web Activity (Bubblewrap) with this PWA.

Files:
- index.html, style.css, logic.js
- worker.js for smoothing/noise filtering
- chart-history.json seeded example history
- sw.js + manifest.json for install/offline
- assets/ icons
