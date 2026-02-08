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

export async function fetchTicks() {
  // Fetch full history (limited for performance).
  const { data, error } = await supabase
    .from('gold_ticks')
    .select('id, ts, price')
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
