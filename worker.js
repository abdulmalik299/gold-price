/* Web Worker for chart data processing
   - Receives raw points [{t,p}] (ms, USD/oz)
   - Applies timeframe windowing + bucket aggregation + moving average smoothing
   - Returns labels (Baghdad HH:MM / date) and values for Chart.js
*/

(() => {
  'use strict';

  const BAGHDAD_TZ = 'Asia/Baghdad';

  function toLabel(ms, tf) {
    // Compact labels based on timeframe
    const d = new Date(ms);
    if (tf === '1H') {
      return new Intl.DateTimeFormat('en-GB', { timeZone: BAGHDAD_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    }
    if (tf === '24H') {
      return new Intl.DateTimeFormat('en-GB', { timeZone: BAGHDAD_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    }
    // 7D
    return new Intl.DateTimeFormat('en-GB', { timeZone: BAGHDAD_TZ, month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).format(d);
  }

  function clampTimeframe(points, tf, nowMs) {
    const hour = 60 * 60 * 1000;
    const day = 24 * hour;
    const windowMs = tf === '1H' ? hour : tf === '24H' ? day : 7 * day;
    const cutoff = nowMs - windowMs;
    return points.filter(p => p.t >= cutoff);
  }

  function aggregate(points, tf) {
    // Bucket size: 1H => 10s, 24H => 1m, 7D => 10m
    const bucketMs = tf === '1H' ? 10_000 : tf === '24H' ? 60_000 : 600_000;
    const buckets = new Map();
    for (const pt of points) {
      const key = Math.floor(pt.t / bucketMs) * bucketMs;
      const b = buckets.get(key) || { sum: 0, count: 0 };
      b.sum += pt.p;
      b.count += 1;
      buckets.set(key, b);
    }
    const out = [];
    const keys = Array.from(buckets.keys()).sort((a,b)=>a-b);
    for (const k of keys) {
      const b = buckets.get(k);
      out.push({ t: k, p: b.sum / b.count });
    }
    return out;
  }

  function movingAverage(values, windowSize) {
    if (values.length === 0) return [];
    const w = Math.max(1, windowSize);
    const out = new Array(values.length).fill(0);
    let sum = 0;
    for (let i=0;i<values.length;i++){
      sum += values[i];
      if (i >= w) sum -= values[i - w];
      const denom = (i < w) ? (i + 1) : w;
      out[i] = sum / denom;
    }
    return out;
  }

  self.addEventListener('message', (e) => {
    const msg = e.data || {};
    if (msg.type !== 'process') return;

    const tf = msg.tf || '24H';
    const raw = Array.isArray(msg.points) ? msg.points : [];

    // Normalize
    const points = raw
      .map(p => ({ t: Number(p.t), p: Number(p.p) }))
      .filter(p => Number.isFinite(p.t) && Number.isFinite(p.p))
      .sort((a,b)=>a.t-b.t);

    const nowMs = points.length ? points[points.length-1].t : Date.now();
    const clipped = clampTimeframe(points, tf, nowMs);
    const agg = aggregate(clipped, tf);

    // Smooth: MA window based on timeframe
    const values = agg.map(a => a.p);
    const smoothed = movingAverage(values, tf === '1H' ? 6 : tf === '24H' ? 6 : 8);

    const labels = agg.map(a => toLabel(a.t, tf));

    self.postMessage({
      ok: true,
      tf,
      labels,
      values: smoothed,
    });
  });
})(); 
