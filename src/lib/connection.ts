export type ConnectionSnapshot = {
  online: boolean;
  rttMs: number | null;
  downKbps: number | null;
  quality: 'good' | 'mid' | 'bad';
};

function nowMs() {
  return performance.now();
}

/**
 * Quick "ping" using a small request.
 * Note: RTT is approximate and depends on the browser/network.
 */
export async function measureRttAndDown(): Promise<Pick<ConnectionSnapshot, 'rttMs' | 'downKbps'>> {
  const url = `https://api.gold-api.com/price/XAU?cachebust=${Date.now()}`;
  const t0 = nowMs();
  const r = await fetch(url, { cache: 'no-store' });
  const t1 = nowMs();
  if (!r.ok) throw new Error('ping failed');

  // Rough download speed: response size / time
  const text = await r.text();
  const bytes = new Blob([text]).size;
  const sec = Math.max((nowMs() - t0) / 1000, 0.001);
  const kbps = (bytes * 8) / 1024 / sec;
  return { rttMs: Math.round(t1 - t0), downKbps: Math.round(kbps) };
}

export function classifyQuality(rttMs: number | null, downKbps: number | null): ConnectionSnapshot['quality'] {
  // heuristics
  if (rttMs == null || downKbps == null) return 'bad';
  if (rttMs < 180 && downKbps > 800) return 'good';
  if (rttMs < 450 && downKbps > 250) return 'mid';
  return 'bad';
}

export function watchConnection(onUpdate: (snap: ConnectionSnapshot) => void) {
  let stopped = false;

  const publish = async () => {
    if (stopped) return;
    const online = navigator.onLine;
    if (!online) {
      onUpdate({ online: false, rttMs: null, downKbps: null, quality: 'bad' });
      return;
    }
    try {
      const m = await measureRttAndDown();
      onUpdate({ online: true, ...m, quality: classifyQuality(m.rttMs, m.downKbps) });
    } catch {
      onUpdate({ online: false, rttMs: null, downKbps: null, quality: 'bad' });
    }
  };

  const onOnline = () => publish();
  const onOffline = () => publish();

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  publish();
  const id = window.setInterval(publish, 8000);

  return () => {
    stopped = true;
    clearInterval(id);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
