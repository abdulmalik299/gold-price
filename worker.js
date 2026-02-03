/* Web Worker: smoothing / noise filtering / history processing
   - Accepts raw price ticks
   - Only emits "price_changed" when price changed by >= threshold
   - Maintains a compact history list for the chart
*/

const state = {
  threshold: 0.10,
  lastAccepted: null,
  history: [], // {t:number, p:number}
  maxPoints: 4000
};

function clampHistory(){
  const over = state.history.length - state.maxPoints;
  if (over > 0) state.history.splice(0, over);
}

function acceptPrice(p){
  if (typeof p !== "number" || !isFinite(p)) return false;
  if (state.lastAccepted == null){
    state.lastAccepted = p;
    return true;
  }
  const diff = Math.abs(p - state.lastAccepted);
  if (diff >= state.threshold){
    state.lastAccepted = p;
    return true;
  }
  return false;
}

self.onmessage = (ev) => {
  const msg = ev.data || {};
  if (msg.type === "init"){
    state.threshold = Number(msg.threshold ?? state.threshold);
    state.maxPoints = Number(msg.maxPoints ?? state.maxPoints);
    if (Array.isArray(msg.seedHistory)){
      state.history = msg.seedHistory
        .filter(x => x && typeof x.t === "number" && typeof x.p === "number" && isFinite(x.p))
        .sort((a,b) => a.t - b.t);
      clampHistory();
      // set lastAccepted to most recent point for consistent deltas
      if (state.history.length) state.lastAccepted = state.history[state.history.length - 1].p;
    }
    postMessage({ type:"ready", lastAccepted: state.lastAccepted, historyCount: state.history.length });
    return;
  }

  if (msg.type === "tick"){
    const p = Number(msg.price);
    const now = Number(msg.t ?? Date.now());
    const ok = acceptPrice(p);
    if (!ok){
      postMessage({ type:"no_change", t: now, price: p });
      return;
    }
    state.history.push({ t: now, p });
    clampHistory();
    postMessage({ type:"price_changed", t: now, price: p, historyTail: state.history.slice(-300) });
    return;
  }

  if (msg.type === "get_history"){
    postMessage({ type:"history", history: state.history.slice() });
    return;
  }

  if (msg.type === "set_threshold"){
    state.threshold = Number(msg.threshold ?? state.threshold);
    postMessage({ type:"threshold", threshold: state.threshold });
    return;
  }
};
