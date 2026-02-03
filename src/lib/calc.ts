export const OUNCE_TO_G = 31.1035
export const MITHQAL_G = 5

export type KaratKey = '24k' | '22k' | '21k' | '18k'
export type UnitKey = 'mithqal' | 'gram'

export const KARAT_FACTOR: Record<KaratKey, number> = {
  '24k': 1.0,
  '22k': 0.916,
  '21k': 0.875,
  '18k': 0.75,
}

export function pricePerGramFromOunce(ounceUsd: number): number {
  return ounceUsd / OUNCE_TO_G
}

export function priceForKarat(
  ounceUsd: number,
  karat: KaratKey,
  unit: UnitKey,
  usdToIqd: number | null,
  marginIqd: number
) {
  const perGramUsd = pricePerGramFromOunce(ounceUsd) * KARAT_FACTOR[karat]
  const grams = unit === 'mithqal' ? MITHQAL_G : 1
  const baseUsd = perGramUsd * grams

  // Conversion rule:
  // - Karats can be shown in USD or IQD depending on usdToIqd input.
  // - Margin is IQD only and only applies when usdToIqd is provided.
  if (usdToIqd && usdToIqd > 0) {
    const baseIqd = baseUsd * usdToIqd
    const totalIqd = baseIqd + marginIqd
    return { currency: 'IQD' as const, base: baseIqd, total: totalIqd }
  }
  return { currency: 'USD' as const, base: baseUsd, total: baseUsd }
}

export function deltaAndPercent(now: number, prev: number | null) {
  if (prev == null || !Number.isFinite(prev) || prev === 0) return { delta: 0, pct: 0 }
  const delta = now - prev
  const pct = (delta / prev) * 100
  return { delta, pct }
}
