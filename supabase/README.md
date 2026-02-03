# Supabase setup (History Chart)

This dashboard reads history from Supabase table `gold_ticks`.

The **Edge Function** `gold-poller` fetches Gold API and inserts a new row **only when the ounce price changes**.
Then the website can show the history even if nobody opened the site.

## 1) Create table + policies

Run the SQL in `supabase/schema.sql` inside Supabase SQL Editor.

## 2) Deploy Edge Function

From Supabase CLI:

```bash
supabase functions deploy gold-poller
```

Set secrets (Supabase Dashboard → Project Settings → Functions → Secrets):

- `GOLD_API_URL` = `https://api.gold-api.com/price/XAU`
- `SUPABASE_URL` = your project url
- `SUPABASE_SERVICE_ROLE_KEY` = service role key (DO NOT put in frontend)

## 3) Schedule (runs even when site is closed)

Supabase supports scheduling Edge Functions via `pg_cron` + `pg_net`. See Supabase docs:
- Scheduling Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- Cron module: https://supabase.com/docs/guides/cron

Run the SQL in `supabase/schedule.sql` to call your function every minute.

> You can change the schedule as needed (e.g. every 15s if your plan supports it).

## Notes on security

- Frontend uses **anon** key, read-only due to RLS.
- Only the Edge Function writes using the **service role** key.
