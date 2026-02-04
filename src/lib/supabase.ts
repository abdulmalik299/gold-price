import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../env'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

export type GoldTick = {
  id: string
  ts: string
  price: number
}

export async function fetchTicks(range: '24h' | '7d' | 'months' | 'years') {
  const now = new Date()
  let since = new Date(now)
  if (range === '24h') since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (range === '7d') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (range === 'months') since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000) // show up to 12 months
  if (range === 'years') since = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000) // up to 5 years

  // We fetch raw ticks; the UI worker will bucket them for months/years.
  const { data, error } = await supabase
    .from('gold_ticks')
    .select('id, ts, price')
    .gte('ts', since.toISOString())
    .order('ts', { ascending: true })
    .limit(5000)

  if (error) throw error
  return (data ?? []) as GoldTick[]
}

export async function fetchTickAtOrBefore(isoTime: string): Promise<GoldTick | null> {
  const { data, error } = await supabase
    .from('gold_ticks')
    .select('id, ts, price')
    .lte('ts', isoTime)
    .order('ts', { ascending: false })
    .limit(1)

  if (error) throw error
  return (data?.[0] as GoldTick | undefined) ?? null
}
