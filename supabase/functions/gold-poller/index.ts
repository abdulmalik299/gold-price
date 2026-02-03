/**
 * Supabase Edge Function: gold-poller
 * - Fetches https://api.gold-api.com/price/XAU
 * - Inserts into public.gold_prices ONLY when price changed vs latest stored row
 * - Safe to run on a schedule (Supabase Cron / pg_cron)
 *
 * Required secrets (Supabase Dashboard -> Project Settings -> Functions -> Secrets):
 *  - SUPABASE_URL
 *  - SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *  - GOLD_API_URL (defaults to the gold-api endpoint)
 */

import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type GoldApiResponse = {
  name: string;
  symbol: string;
  price: number;
  updatedAt: string;
  updatedAtReadable?: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json; charset=utf-8' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return json({ ok: false, error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
    }

    const apiUrl = Deno.env.get('GOLD_API_URL') ?? 'https://api.gold-api.com/price/XAU';

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const r = await fetch(apiUrl, { headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) return json({ ok: false, error: `Gold API ${r.status}` }, 502);

    const payload = (await r.json()) as GoldApiResponse;
    if (!Number.isFinite(payload.price)) return json({ ok: false, error: 'Invalid price' }, 502);

    // Latest stored price
    const { data: latest, error: selErr } = await supabase
      .from('gold_prices')
      .select('price, ts')
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selErr) return json({ ok: false, error: selErr.message }, 500);

    const latestPrice = latest?.price != null ? Number(latest.price) : null;
    const changed = latestPrice == null ? true : payload.price !== latestPrice;

    if (!changed) {
      return json({ ok: true, changed: false, price: payload.price, at: payload.updatedAt });
    }

    const ts = payload.updatedAt ? new Date(payload.updatedAt).toISOString() : new Date().toISOString();

    const { error: insErr } = await supabase.from('gold_prices').insert({
      ts,
      symbol: payload.symbol ?? 'XAU',
      price: payload.price,
      source_updated_at: payload.updatedAt ? new Date(payload.updatedAt).toISOString() : null,
    });

    if (insErr) {
      // If unique ts collision, treat as not-changed
      if (String(insErr.message || '').toLowerCase().includes('duplicate')) {
        return json({ ok: true, changed: false, price: payload.price, at: ts, note: 'duplicate ts' });
      }
      return json({ ok: false, error: insErr.message }, 500);
    }

    return json({ ok: true, changed: true, price: payload.price, at: ts });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});
