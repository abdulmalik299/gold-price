-- supabase/sql/setup.sql
-- Creates a history table and permissive read policies for anonymous clients.
-- 1) Run in Supabase SQL editor.

create table if not exists public.gold_history (
  ts bigint primary key,
  price numeric not null
);

-- Helpful index for range queries
create index if not exists gold_history_ts_idx on public.gold_history (ts desc);

alter table public.gold_history enable row level security;

-- Allow anyone to read history (public chart)
drop policy if exists "public read gold_history" on public.gold_history;
create policy "public read gold_history"
on public.gold_history for select
to anon, authenticated
using (true);

-- Optional: allow anon inserts only if you want the WEBSITE to write history
-- (If you prefer only the edge function to write, keep inserts disabled.)
drop policy if exists "public insert gold_history" on public.gold_history;
create policy "public insert gold_history"
on public.gold_history for insert
to anon, authenticated
with check (true);
