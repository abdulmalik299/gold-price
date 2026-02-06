import { clamp } from './format'

export type NetStatus = {
  online: boolean
  rttMs: number | null
  downKBps: number | null
  at: number
}

type NavigatorWithConnection = Navigator & {
  connection?: {
    downlink?: number
  }
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

async function measureDownKBps(timeoutMs = 8000): Promise<number | null> {
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
    const kbPerSecond = bytes / 1024 / seconds
    return clamp(kbPerSecond, 0, 1_000_000)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

function fallbackDownKBpsFromConnection(): number | null {
  const downlinkMbps = (navigator as NavigatorWithConnection).connection?.downlink
  if (downlinkMbps == null || !Number.isFinite(downlinkMbps) || downlinkMbps <= 0) return null
  return clamp(downlinkMbps * 1024 / 8, 0, 1_000_000)
}

export async function sampleNetwork(): Promise<NetStatus> {
  const online = navigator.onLine
  if (!online) return { online: false, rttMs: null, downKBps: null, at: Date.now() }

  const [rttMs, measuredDownKBps] = await Promise.all([measureRttMs(), measureDownKBps()])
  const downKBps = measuredDownKBps ?? fallbackDownKBpsFromConnection()

  // If both metrics are missing, treat this sample as offline-ish.
  const ok = rttMs != null || downKBps != null
  return { online: ok, rttMs: ok ? rttMs : null, downKBps: ok ? downKBps : null, at: Date.now() }
}
