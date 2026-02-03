/* LuxGold worker.js
   Purpose:
   - filter noisy ticks (ignore changes below $0.10 by default)
   - smooth series for chart using EMA + median window
*/

let lastAccepted = null;

function median(arr){
  const a = arr.slice().sort((x,y)=>x-y);
  const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1]+a[m])/2;
}

function ema(series, alpha=0.22){
  let out = [];
  let prev = null;
  for(const p of series){
    if(prev == null) prev = p.price;
    else prev = alpha * p.price + (1-alpha) * prev;
    out.push({ ts: p.ts, price: +prev.toFixed(2) });
  }
  return out;
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if(msg.type === "tick"){
    const { ts, price, minMove=0.10 } = msg;
    if(lastAccepted == null){
      lastAccepted = { ts, price };
      self.postMessage({ type:"tickAccepted", accepted:true, tick:{ts,price} });
      return;
    }
    const diff = Math.abs(price - lastAccepted.price);
    if(diff < minMove){
      self.postMessage({ type:"tickAccepted", accepted:false, tick:{ts,price} });
      return;
    }
    lastAccepted = { ts, price };
    self.postMessage({ type:"tickAccepted", accepted:true, tick:{ts,price} });
    return;
  }

  if(msg.type === "smooth"){
    const series = Array.isArray(msg.series) ? msg.series : [];
    const w = Math.max(3, Math.min(15, msg.window || 7));
    const minMove = msg.minMove ?? 0.10;

    // median filter first (robust)
    let med = [];
    for(let i=0;i<series.length;i++){
      const start = Math.max(0, i - Math.floor(w/2));
      const end = Math.min(series.length, i + Math.floor(w/2)+1);
      const chunk = series.slice(start, end).map(p=>p.price);
      const m = median(chunk);
      med.push({ ts: series[i].ts, price: +m.toFixed(2) });
    }

    // EMA for smooth motion
    const sm = ema(med, msg.alpha ?? 0.22);

    // Also compute quick stats
    let high = -Infinity, low = Infinity;
    for(const p of sm){
      if(p.price > high) high = p.price;
      if(p.price < low) low = p.price;
    }
    const vol = (high-low);

    self.postMessage({ type:"smoothed", series: sm, stats: { high, low, vol, minMove } });
  }
};
