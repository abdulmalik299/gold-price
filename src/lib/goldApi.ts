import { GOLD_API_URL } from '../env'

export type GoldApiResponse = {
  price: number
  metal?: string
  currency?: string
  timestamp?: number
}

export async function fetchLiveOuncePrice(signal?: AbortSignal): Promise<number> {
  const res = await fetch(GOLD_API_URL, { cache: 'no-store', signal })
  if (!res.ok) throw new Error(`Gold API failed: ${res.status}`)
  const data = (await res.json()) as Partial<GoldApiResponse>

  // We only rely on "price" being numeric.
  const p = Number((data as any).price)
  if (!Number.isFinite(p)) throw new Error('Gold API returned invalid price')
  return p
}
