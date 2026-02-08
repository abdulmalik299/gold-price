export function clamp(n: number, a: number, b: number) {
  return Math.min(b, Math.max(a, n))
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

export function parseLooseNumber(input: string): number | null {
  // Accept commas/spaces
  const cleaned = input.replace(/,/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function formatWithCommas(n: number, decimals = 2): string {
  const opts: Intl.NumberFormatOptions = {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }
  return new Intl.NumberFormat('en-US', opts).format(n)
}

export function formatMoney(
  n: number | null,
  currency: 'USD' | 'IQD',
  decimals?: number
): string {
  if (n == null || !Number.isFinite(n)) return '—'

  if (currency === 'IQD') {
    const d = decimals ?? 0
    return `${formatWithCommas(n, d)} IQD`
  }

  const d = decimals ?? 2
  return `$${formatWithCommas(n, d)}`
}

/**
 * Percent formatter that safely handles null / undefined
 */
export function formatPercent(p: number | null): string {
  if (p == null || !Number.isFinite(p)) return '—'

  const sign = p > 0 ? '+' : p < 0 ? '−' : ''
  const abs = Math.abs(p)
  return `${sign}${formatWithCommas(abs, 2)}%`
}

/**
 * Arrow + tone helper
 * If delta is null → neutral state
 */
export function arrowForDelta(delta: number | null) {
  if (delta == null || !Number.isFinite(delta)) {
    return { arrow: '•', tone: 'flat' as const }
  }
  if (delta > 0) return { arrow: '▲', tone: 'up' as const }
  if (delta < 0) return { arrow: '▼', tone: 'down' as const }
  return { arrow: '•', tone: 'flat' as const }
}

export function nowLocalDateString(): string {
  const d = new Date()
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function hhmmss(): string {
  const d = new Date()
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}
