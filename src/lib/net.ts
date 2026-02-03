import { clamp } from './format'

export type NetStatus = {
  online: boolean
  rttMs: number | null
  downKbps: number | null
  at: number
}

async function measureRttMs(timeoutMs = 5000): Promise<number | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  const start = performance.now()
  try {
    // Use a cache-busted HEAD to same-origin (works on GitHub Pages)
    const url = new URL(location.origin + (import.meta.env.BASE_URL || '/') + 'speed-test.bin')
    url.searchParams.set('t', String(Date.now()))
    const res = await fetch(url.toString(), { method: 'HEAD', cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) return null
    const end = performance.now()
    return Math.max(0, end - start)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function measureDownKbps(timeoutMs = 8000): Promise<number | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)

  const start = performance.now()
  try {
    const url = new URL(location.origin + (import.meta.env.BASE_URL || '/') + 'speed-test.bin')
    url.searchParams.set('t', String(Date.now()))
    const res = await fetch(url.toString(), { cache: 'no-store', signal: ctrl.signal })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const end = performance.now()
    const bytes = buf.byteLength
    const seconds = (end - start) / 1000
    if (seconds <= 0) return null
    const kbps = (bytes * 8) / 1024 / seconds
    return clamp(kbps, 0, 1_000_000)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function sampleNetwork(): Promise<NetStatus> {
  const online = navigator.onLine
  if (!online) return { online: false, rttMs: null, downKbps: null, at: Date.now() }

  const [rttMs, downKbps] = await Promise.all([measureRttMs(), measureDownKbps()])
  // If we can't fetch, treat as offline-ish.
  const ok = rttMs != null
  return { online: ok, rttMs: ok ? rttMs : null, downKbps: ok ? downKbps : null, at: Date.now() }
}
