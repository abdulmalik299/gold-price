import type { GoldPoint, Timeframe } from '../lib/chart/types';

type InMsg =
  | { type: 'process'; points: GoldPoint[]; timeframe: Timeframe; tzOffsetMinutes: number };

type OutMsg =
  | {
      type: 'processed';
      timeframe: Timeframe;
      series: { time: number; value: number }[];
      min: number;
      max: number;
    };

function toEpochSec(iso: string) {
  return Math.floor(new Date(iso).getTime() / 1000);
}

function groupKey(epochSec: number, timeframe: Timeframe, tzOffsetMinutes: number) {
  const ms = epochSec * 1000;
  const d = new Date(ms + tzOffsetMinutes * 60_000);
  if (timeframe === '24h') {
    // group by minute
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
  }
  if (timeframe === '7d') {
    // group by hour
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}`;
  }
  if (timeframe === 'months') {
    // group by day
    return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  }
  // years: group by month
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

/**
 * Resample to reduce noise & improve smoothness.
 * We keep the *last* value in each bucket.
 */
function resample(points: GoldPoint[], timeframe: Timeframe, tzOffsetMinutes: number) {
  const map = new Map<string, { t: number; v: number }>();
  for (const p of points) {
    const t = toEpochSec(p.ts);
    const key = groupKey(t, timeframe, tzOffsetMinutes);
    map.set(key, { t, v: p.price });
  }
  const series = Array.from(map.values())
    .sort((a, b) => a.t - b.t)
    .map((x) => ({ time: x.t, value: x.v }));

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const s of series) {
    min = Math.min(min, s.value);
    max = Math.max(max, s.value);
  }
  if (!Number.isFinite(min)) min = 0;
  if (!Number.isFinite(max)) max = 0;
  return { series, min, max };
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  const msg = ev.data;
  if (msg.type === 'process') {
    const { series, min, max } = resample(msg.points, msg.timeframe, msg.tzOffsetMinutes);
    const out: OutMsg = { type: 'processed', timeframe: msg.timeframe, series, min, max };
    // @ts-expect-error - worker global
    self.postMessage(out);
  }
};
