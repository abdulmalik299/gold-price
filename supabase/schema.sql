-- Schema for Live Gold Price Chart
-- Table stores ounce price history; insert ONLY when price changes.

create extension if not exists pgcrypto;

create table if not exists public.gold_ticks (
  id uuid primary key default gen_random_uuid(),
  ts timestamptz not null default now(),
  price numeric not null
);

create index if not exists gold_ticks_ts_idx on public.gold_ticks (ts);

-- Enable RLS
alter table public.gold_ticks enable row level security;

-- Read-only for anon
drop policy if exists "read ticks" on public.gold_ticks;
create policy "read ticks"
on public.gold_ticks
for select
to anon
using (true);

-- Block inserts/updates/deletes from anon
drop policy if exists "no write for anon" on public.gold_ticks;
create policy "no write for anon"
on public.gold_ticks
for all
to anon
using (false)
with check (false);
