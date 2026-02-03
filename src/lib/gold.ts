import { clamp } from './format';

export const OUNCE_GRAMS = 31.1035;
export const MITHQAL_GRAMS = 5;

export type Karat = 24 | 22 | 21 | 18;
export type Unit = 'mithqal' | 'gram';

export function karatPurity(k: Karat) {
  switch (k) {
    case 24:
      return 1;
    case 22:
      return 0.916;
    case 21:
      return 0.875;
    case 18:
      return 0.75;
  }
}

export function pricePerGramFromOunce(ounceUsd: number) {
  return ounceUsd / OUNCE_GRAMS;
}

export function priceKaratPerGramFromOunce(ounceUsd: number, k: Karat) {
  return pricePerGramFromOunce(ounceUsd) * karatPurity(k);
}

export function priceKaratPerMithqalFromOunce(ounceUsd: number, k: Karat) {
  return priceKaratPerGramFromOunce(ounceUsd, k) * MITHQAL_GRAMS;
}

export function applyFxAndMargin(
  baseUsd: number,
  fxUsdToIqd: number | null,
  marginIqd: number
) {
  if (!fxUsdToIqd) return { value: baseUsd, currency: 'USD' as const };
  const iqd = baseUsd * fxUsdToIqd + clamp(marginIqd, 0, 70000);
  return { value: iqd, currency: 'IQD' as const };
}

export type GoldApiResponse = {
  name: string;
  symbol: string;
  price: number;
  updatedAt: string;
  updatedAtReadable?: string;
};

export async function fetchLiveGoldXAU(): Promise<GoldApiResponse> {
  const r = await fetch('https://api.gold-api.com/price/XAU', { cache: 'no-store' });
  if (!r.ok) throw new Error(`Gold API error: ${r.status}`);
  const j = (await r.json()) as GoldApiResponse;
  if (!Number.isFinite(j.price)) throw new Error('Gold API: invalid price');
  return j;
}
