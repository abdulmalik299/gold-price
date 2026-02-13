/// <reference lib="webworker" />
/**
 * Worker: bucket / downsample chart ticks for smooth UI.
 * - Auto bucket based on span for full-history charts.
 */
export type Tick = { ts: string; price: number }
export type Prepared = { x: number; y: number }[]

type WorkerRequest = { ticks: Tick[]; requestId?: number }

function toMs(ts: string) {
  const n = Date.parse(ts)
  return Number.isFinite(n) ? n : 0
}

function bucketBy(ticks: Tick[], keyFn: (ms: number) => number): Prepared {
  const map = new Map<number, { lastY: number }>()
  for (const t of ticks) {
    const ms = toMs(t.ts)
    const k = keyFn(ms)
    map.set(k, { lastY: t.price })
  }
  const out: Prepared = []
  const keys = Array.from(map.keys()).sort((a, b) => a - b)
  for (const k of keys) {
    const v = map.get(k)!
    // Use the latest value in each bucket to avoid synthetic trend lines.
    out.push({ x: k, y: v.lastY })
  }
  return out
}

function downsampleLttb(points: Prepared, threshold: number): Prepared {
  // Minimal LTTB for perf. If threshold >= points length, return as-is.
  if (threshold >= points.length || threshold <= 2) return points
  const sampled: Prepared = []
  const every = (points.length - 2) / (threshold - 2)
  let a = 0
  sampled.push(points[a])
  for (let i = 0; i < threshold - 2; i++) {
    const avgRangeStart = Math.floor((i + 1) * every) + 1
    const avgRangeEnd = Math.floor((i + 2) * every) + 1
    const avgRange = points.slice(avgRangeStart, avgRangeEnd)
    const avgX = avgRange.reduce((s, p) => s + p.x, 0) / Math.max(1, avgRange.length)
    const avgY = avgRange.reduce((s, p) => s + p.y, 0) / Math.max(1, avgRange.length)

    const rangeOffs = Math.floor(i * every) + 1
    const rangeTo = Math.floor((i + 1) * every) + 1
    const range = points.slice(rangeOffs, rangeTo)

    let maxArea = -1
    let nextA = rangeOffs
    for (let j = 0; j < range.length; j++) {
      const p = range[j]
      const area = Math.abs((points[a].x - avgX) * (p.y - points[a].y) - (points[a].x - p.x) * (avgY - points[a].y))
      if (area > maxArea) {
        maxArea = area
        nextA = rangeOffs + j
      }
    }
    sampled.push(points[nextA])
    a = nextA
  }
  sampled.push(points[points.length - 1])
  return sampled
}

self.onmessage = (e: MessageEvent<{ ticks: Tick[] }>) => {
  const { ticks, requestId } = e.data as WorkerRequest
  let prepared: Prepared = ticks
    .map((t) => ({ x: toMs(t.ts), y: t.price }))
    .filter((point) => point.x > 0 && Number.isFinite(point.y))
    .sort((a, b) => a.x - b.x)

  // Deduplicate by timestamp while preserving the latest point at each same x.
  const deduped: Prepared = []
  for (const point of prepared) {
    const last = deduped[deduped.length - 1]
    if (last && last.x === point.x) {
      deduped[deduped.length - 1] = point
      continue
    }
    deduped.push(point)
  }

  // Remove sequential duplicates where the price did not update.
  prepared = deduped.filter((point, i, arr) => i === 0 || point.y !== arr[i - 1].y || i === arr.length - 1)

  const spanMs = prepared.length ? prepared[prepared.length - 1].x - prepared[0].x : 0

  if (spanMs > 2 * 365 * 24 * 60 * 60_000) {
    prepared = bucketBy(ticks, (ms) => {
      const d = new Date(ms)
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })
  } else if (spanMs > 90 * 24 * 60 * 60_000) {
    prepared = bucketBy(ticks, (ms) => {
      const d = new Date(ms)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })
  }

  // Only downsample larger series to preserve fidelity for short ranges.
  if (prepared.length > 1500) {
    prepared = downsampleLttb(prepared, 900)
  }

  (self as any).postMessage({ prepared, requestId })
}
