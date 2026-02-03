// Supabase Edge Function: gold-poller
// Inserts a new tick only when the ounce price changes.
// Uses SERVICE_ROLE key (server-side only).
//
// Set secrets:
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY
// - GOLD_API_URL (default: https://api.gold-api.com/price/XAU)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.94.0'

type GoldApi = { price: number }

Deno.serve(async (_req) => {
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const GOLD_API_URL = Deno.env.get('GOLD_API_URL') || 'https://api.gold-api.com/price/XAU'

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })

    const res = await fetch(GOLD_API_URL, { cache: 'no-store' })
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Gold API: ${res.status}` }), { status: 502 })
    }
    const data = (await res.json()) as Partial<GoldApi>
    const price = Number((data as any).price)
    if (!Number.isFinite(price)) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid price' }), { status: 500 })
    }

    // Fetch last tick
    const { data: last, error: lastErr } = await supabase
      .from('gold_ticks')
      .select('price, ts')
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (lastErr) {
      return new Response(JSON.stringify({ ok: false, error: lastErr.message }), { status: 500 })
    }

    const lastPrice = last?.price != null ? Number(last.price) : null
    if (lastPrice != null && Number.isFinite(lastPrice) && lastPrice === price) {
      return new Response(JSON.stringify({ ok: true, inserted: false, price }), { status: 200 })
    }

    const { error: insErr } = await supabase.from('gold_ticks').insert({ price })
    if (insErr) {
      return new Response(JSON.stringify({ ok: false, error: insErr.message }), { status: 500 })
    }

    return new Response(JSON.stringify({ ok: true, inserted: true, price }), { status: 200 })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message ?? String(e) }), { status: 500 })
  }
})
