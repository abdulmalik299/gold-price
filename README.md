# Lux Gold Dashboard (Vanilla)

Open `index.html` directly (no build tools). Everything is vanilla HTML/CSS/JS.

## Live API
Uses: https://api.gold-api.com/price/XAU

Gold API docs mention CORS enabled for website usage.

## Supabase (recommended for global history)
Project URL is set to:
https://ypdpopphenmbtivdtlip.supabase.co

To store history even when the website is closed (so anyone opening later sees missed data):

1) Run `supabase/sql/setup.sql` in Supabase SQL editor.
2) Deploy the edge function in `supabase/functions/gold-poller/`.
3) Set Supabase env vars:
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
4) Create a scheduled trigger (Supabase Cron) for the function (e.g. every 2 minutes).

### Client side
In the website, open **Settings** and paste your Supabase anon key (it is stored only in your browser).
If you keep insert policy enabled, the website also inserts accepted ticks (noise filtered).

## Android install (“APK-like”)
This is a PWA:
- Host the folder (recommended) or open from local.
- On Android Chrome: menu → **Add to Home screen**.

For a real APK wrapper, use Trusted Web Activity tools (e.g. Bubblewrap) pointing to your hosted URL.
