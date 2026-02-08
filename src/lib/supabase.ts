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
  const all: GoldTick[] = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const to = from + pageSize - 1
    const { data, error } = await supabase
      .from('gold_ticks')
      .select('id, ts, price')
      .order('ts', { ascending: true })
      .range(from, to)

    if (error) throw error
    if (!data?.length) break
    all.push(...(data as GoldTick[]))
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
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
