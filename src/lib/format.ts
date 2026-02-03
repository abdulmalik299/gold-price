export type Currency = 'USD' | 'IQD';

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function toNumberLoose(input: string): number | null {
  const cleaned = input.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(
  n: number,
  opts: Intl.NumberFormatOptions = {},
  locale = 'en-US'
) {
  return new Intl.NumberFormat(locale, opts).format(n);
}

export function formatMoney(n: number, currency: Currency) {
  if (currency === 'USD') {
    return `$${formatNumber(n, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  // IQD has no decimals commonly shown
  return `${formatNumber(Math.round(n), { maximumFractionDigits: 0 })} IQD`;
}

export function formatDeltaMoney(n: number, currency: Currency) {
  const sign = n >= 0 ? '+' : '−';
  const abs = Math.abs(n);
  if (currency === 'USD') {
    return `${sign}$${formatNumber(abs, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
  }
  return `${sign}${formatNumber(Math.round(abs), { maximumFractionDigits: 0 })} IQD`;
}

export function formatPct(p: number) {
  const sign = p >= 0 ? '+' : '−';
  const abs = Math.abs(p);
  return `${sign}${formatNumber(abs, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`;
}

export function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtDateTime(d: Date) {
  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formats a numeric string while user types:
 * - allows digits + one dot
 * - strips commas
 * - returns commas in integer part
 */
export function formatNumericStringForInput(raw: string): string {
  const cleaned = raw.replace(/[\s,_]/g, '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  if (!cleaned) return '';
  // keep leading minus only if first char
  const sign = cleaned.startsWith('-') ? '-' : '';
  const s = cleaned.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
  if (!s) return sign ? '-' : '';
  const [intPartRaw, decPartRaw] = s.split('.');
  const intPart = intPartRaw.replace(/^0+(?=\d)/, '');
  const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (decPartRaw === undefined) return sign + intWithCommas;
  return sign + intWithCommas + '.' + decPartRaw.slice(0, 12);
}
