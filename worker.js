/* worker.js
   Web Worker for smoothing + noise filtering.
   - Noise filter: ignore changes < threshold (default 0.10 USD)
   - Smoothing: EMA + short moving average blend for stable chart line.
*/

let last = null;

function ema(prev, val, alpha){
  if (prev === null || prev === undefined) return val;
  return alpha * val + (1 - alpha) * prev;
}

function movingAverage(values, windowSize){
  if (values.length === 0) return [];
  const out = new Array(values.length);
  let sum = 0;
  for (let i=0;i<values.length;i++){
    sum += values[i];
    if (i >= windowSize) sum -= values[i-windowSize];
    const w = Math.min(i+1, windowSize);
    out[i] = sum / w;
  }
  return out;
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type === "RESET"){
    last = null;
    self.postMessage({type:"RESET_OK"});
    return;
  }

  if (msg.type === "PROCESS"){
    const { points, threshold=0.10 } = msg;
    // points: [{t:number, p:number}]
    const cleaned = [];
    let prevKept = null;

    for (const pt of points){
      const p = Number(pt.p);
      if (!Number.isFinite(p)) continue;
      if (prevKept === null){
        cleaned.push({t: pt.t, p});
        prevKept = p;
        continue;
      }
      if (Math.abs(p - prevKept) >= threshold){
        cleaned.push({t: pt.t, p});
        prevKept = p;
      } else {
        // keep time but nudge with tiny continuity so tooltips work smoothly
        cleaned.push({t: pt.t, p: prevKept});
      }
    }

    // EMA smoothing
    const alpha = 0.22;
    let emaVal = null;
    const emaSeries = cleaned.map(pt => {
      emaVal = ema(emaVal, pt.p, alpha);
      return emaVal;
    });

    // Blend with moving average for premium stability
    const ma = movingAverage(emaSeries, 5);
    const smooth = emaSeries.map((v, i) => (v*0.65 + ma[i]*0.35));

    const out = cleaned.map((pt, i) => ({t: pt.t, p: smooth[i]}));
    last = out.length ? out[out.length-1].p : last;

    self.postMessage({type:"PROCESSED", points: out});
    return;
  }
};
