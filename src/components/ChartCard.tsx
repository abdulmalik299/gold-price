import React from 'react'
import { fetchTicks, type GoldTick } from '../lib/supabase'
import { formatMoney } from '../lib/format'

import {
  Chart as ChartJS,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Filler,
  Legend,
  type ChartOptions,
  type Chart,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import 'hammerjs'
import zoomPlugin from 'chartjs-plugin-zoom'

ChartJS.register(LineController, LineElement, PointElement, LinearScale, TimeScale, Tooltip, Filler, Legend, zoomPlugin)

type RangeKey = '24h' | '7d' | 'months' | 'years'
const RANGE_ITEMS: { key: RangeKey; label: string }[] = [
  { key: '24h', label: '24H' },
  { key: '7d', label: '7 Days' },
  { key: 'months', label: 'Months' },
  { key: 'years', label: 'Years' },
]

// Crosshair (+ ruler) plugin
const crosshairPlugin = {
  id: 'luxCrosshair',
  afterDraw(chart: Chart) {
    const ctx = chart.ctx
    const active = chart.getActiveElements()
    if (!active || active.length === 0) return

    const { x, y } = active[0].element
    const { chartArea } = chart
    ctx.save()
    ctx.lineWidth = 1
    ctx.setLineDash([6, 6])
    ctx.strokeStyle = 'rgba(255, 215, 122, 0.35)'
    // vertical
    ctx.beginPath()
    ctx.moveTo(x, chartArea.top)
    ctx.lineTo(x, chartArea.bottom)
    ctx.stroke()
    // horizontal
    ctx.beginPath()
    ctx.moveTo(chartArea.left, y)
    ctx.lineTo(chartArea.right, y)
    ctx.stroke()
    // plus center
    ctx.setLineDash([])
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 243, 196, 0.65)'
    ctx.beginPath()
    ctx.moveTo(x - 10, y)
    ctx.lineTo(x + 10, y)
    ctx.moveTo(x, y - 10)
    ctx.lineTo(x, y + 10)
    ctx.stroke()
    ctx.restore()
  },
}

ChartJS.register(crosshairPlugin)

function buildGradient(ctx: CanvasRenderingContext2D, chart: Chart) {
  const { chartArea } = chart
  if (!chartArea) return 'rgba(247, 215, 122, 0.2)'
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom)
  g.addColorStop(0, 'rgba(247, 215, 122, 0.35)')
  g.addColorStop(0.7, 'rgba(247, 215, 122, 0.08)')
  g.addColorStop(1, 'rgba(247, 215, 122, 0.00)')
  return g
}

export default function ChartCard({ liveOunceUsd }: { liveOunceUsd: number | null }) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const chartRef = React.useRef<Chart | null>(null)
  const workerRef = React.useRef<Worker | null>(null)

  const [range, setRange] = React.useState<RangeKey>('24h')
  const [loading, setLoading] = React.useState(false)
  const [lastPoint, setLastPoint] = React.useState<{ ts: number; price: number } | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const userInteractedRef = React.useRef(false)
  const isMiddlePanRef = React.useRef(false)
  const middlePanPosRef = React.useRef<{ x: number; y: number } | null>(null)

  const setPanMode = React.useCallback((chart: Chart, mode: 'x' | 'xy') => {
    const zoomOptions = chart.options.plugins?.zoom
    if (!zoomOptions?.pan) return
    zoomOptions.pan.mode = mode
  }, [])
  
  const setData = React.useCallback(async (ticks: GoldTick[]) => {
    if (!canvasRef.current) return
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/chartWorker.ts', import.meta.url), { type: 'module' })
    }
    const worker = workerRef.current

    const prepared = await new Promise<{ prepared: { x: number; y: number }[] }>((resolve) => {
      const onMsg = (ev: MessageEvent) => {
        worker.removeEventListener('message', onMsg as any)
        resolve(ev.data)
      }
      worker.addEventListener('message', onMsg as any)
      worker.postMessage({ ticks: ticks.map((t) => ({ ts: t.ts, price: t.price })), range })
    })

    const data = prepared.prepared
    const staleOverlayData = buildStaleOverlay(data)
    const last = data.length ? data[data.length - 1] : null
    setLastPoint(last ? { ts: last.x, price: last.y } : null)

    const ctx = canvasRef.current.getContext('2d')!
    if (!chartRef.current) {
      const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'nearest', intersect: false, axis: 'x' },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(10, 12, 18, 0.92)',
            borderColor: 'rgba(247, 215, 122, 0.22)',
            borderWidth: 1,
            titleColor: 'rgba(255,255,255,0.92)',
            bodyColor: 'rgba(255,255,255,0.82)',
            callbacks: {
              label: (ctx) => ` ${formatMoney(ctx.parsed.y, 'USD')}`,
            },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              onPanStart: ({ chart, event }) => {
                const nativeEvent = event?.native
                if (nativeEvent instanceof TouchEvent && nativeEvent.touches?.length === 2) {
                  setPanMode(chart, 'xy')
                  return true
                }
                if (nativeEvent instanceof MouseEvent && nativeEvent.button === 1) {
                  setPanMode(chart, 'xy')
                  return true
                }
                setPanMode(chart, 'x')
                return true
              },
              onPan: () => {
                userInteractedRef.current = true
              },
            },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x',
              onZoom: () => {
                userInteractedRef.current = true
              },
            },
            limits: {
              x: {
                min: 'original',
                max: 'original',
                minRange: getDefaultZoomWindowMs(range),
              },
            },
          },
        },
        scales: {
          x: {
            type: 'time',
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: {
              color: 'rgba(255,255,255,0.55)',
              maxRotation: 0,
              autoSkip: true,
            },
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.06)' },
            ticks: { color: 'rgba(255,255,255,0.55)' },
          },
        },
      }

      chartRef.current = new ChartJS(ctx, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Gold',
              data,
              parsing: false,
              borderWidth: 2,
              pointRadius: 0,
              pointHitRadius: 24,
              tension: 0.26,
              borderColor: 'rgba(247, 215, 122, 0.95)',
              fill: true,
              backgroundColor: (c) => buildGradient(c.chart.ctx, c.chart),
            },
            {
              label: 'No price change > 5 min',
              data: staleOverlayData,
              parsing: false,
              borderWidth: 6,
              pointRadius: 0,
              pointHitRadius: 0,
              tension: 0,
              spanGaps: false,
              borderColor: 'rgba(255, 56, 56, 0.25)',
              fill: false,
            },
          ],
        },
        options,
      })
      applyDefaultZoom(chartRef.current, range)
      return
    }

    const ch = chartRef.current
    const prevScale = ch.scales.x
    const prevMin = Number.isFinite(prevScale?.min) ? prevScale.min : null
    const prevMax = Number.isFinite(prevScale?.max) ? prevScale.max : null
    const prevSpan = prevMin != null && prevMax != null ? prevMax - prevMin : null
    const prevData = ch.data.datasets[0].data as { x: number; y: number }[]
    const prevDataMax = prevData.length ? prevData[prevData.length - 1].x : null
    
    ch.data.datasets[0].data = data as any
    ch.data.datasets[1].data = staleOverlayData as any

    if (prevMin != null && prevMax != null && prevSpan != null && prevDataMax != null && data.length) {
      const newDataMax = data[data.length - 1].x
      const isFollowingLatest = Math.abs(prevDataMax - prevMax) < Math.max(30_000, prevSpan * 0.03)
      const max = !userInteractedRef.current || isFollowingLatest ? newDataMax : prevMax
      const min = max - prevSpan
      setXScaleRange(ch, min, max)
    }
    ch.update()
  }, [range, setPanMode])

  const load = React.useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const ticks = await fetchTicks(range)
      await setData(ticks)
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load history')
    } finally {
      setLoading(false)
    }
  }, [range, setData])

  React.useEffect(() => {
    load()
  }, [load])

  // Refresh chart when a new live price arrives: fetch minimal newest ticks
  React.useEffect(() => {
    if (liveOunceUsd == null) return
    // lightweight refresh every minute when live changes
    // we won't hammer Supabase; edge function updates ticks anyway.
    // This triggers chart to show newest point soon.
    const id = window.setTimeout(() => load(), 30_000)
    return () => window.clearTimeout(id)
  }, [liveOunceUsd, load])

  function resetZoom() {
    const ch = chartRef.current as any
    if (!ch) return
    if (typeof ch.resetZoom === 'function') ch.resetZoom()
    userInteractedRef.current = false
    applyDefaultZoom(chartRef.current, range)
    chartRef.current?.update()
  }

  React.useEffect(() => {
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return
      isMiddlePanRef.current = true
      middlePanPosRef.current = { x: event.clientX, y: event.clientY }
      event.preventDefault()
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!isMiddlePanRef.current || !middlePanPosRef.current) return
      const prev = middlePanPosRef.current
      const deltaX = event.clientX - prev.x
      const deltaY = event.clientY - prev.y
      middlePanPosRef.current = { x: event.clientX, y: event.clientY }
      const chart = chartRef.current as any
      if (chart?.pan) {
        chart.pan({ x: deltaX, y: deltaY }, undefined, 'default')
        chart.update('none')
        userInteractedRef.current = true
      }
    }

    const endMiddlePan = () => {
      isMiddlePanRef.current = false
      middlePanPosRef.current = null
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', endMiddlePan)
    canvas.addEventListener('mouseleave', endMiddlePan)

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', endMiddlePan)
      canvas.removeEventListener('mouseleave', endMiddlePan)
    }
  }, [])

  return (
    <div className="card chart">
      <div className="cardTop">
        <div className="cardTitle">History Chart</div>
        <div className="inlineRight chartControls">
          <div className="rangeBtns">
            {RANGE_ITEMS.map((it) => (
              <button
                key={it.key}
                type="button"
                className={`chip ${range === it.key ? 'chipOn' : ''}`}
                onClick={() => setRange(it.key)}
              >
                <span className="chipGlow" />
                {it.label}
              </button>
            ))}
          </div>
          <button type="button" className="chip" onClick={resetZoom}>
            <span className="chipGlow" />
            Reset zoom
          </button>
        </div>
      </div>

      <div className="chartMeta">
        <div className="pill subtle">
          {loading ? 'Loading…' : err ? `Error: ${err}` : lastPoint ? `Last: ${formatMoney(lastPoint.price, 'USD')} @ ${new Date(lastPoint.ts).toLocaleString()}` : 'No data yet'}
        </div>
        <div className="mutedTiny">
          Desktop: mouse wheel = zoom, middle button drag = pan freely, left click drag = move left/right. Mobile: pinch to zoom, two fingers to pan, one finger to move left/right.
        </div>
      </div>

      <div className="chartWrap">
        <canvas ref={canvasRef} />
        <div className="priceRail">
          <div className="priceRailTitle">Price</div>
          <div className="priceRailHint">Scroll wheel here to zoom too.</div>
        </div>
      </div>

      <div className="mutedTiny">
        
      </div>
    </div>
  )
}

function buildStaleOverlay(points: { x: number; y: number }[], minimumMs = 5 * 60_000) {
  if (points.length < 2) return []

  const overlay = Array.from({ length: points.length }, () => ({ x: NaN, y: NaN }))
  let runStart = 0

  for (let i = 1; i <= points.length; i++) {
    const sameAsStart = i < points.length && points[i].y === points[runStart].y
    if (sameAsStart) continue

    const end = i - 1
    const isChangedAfterRun = i < points.length && points[i].y !== points[runStart].y
    const runDuration = points[end].x - points[runStart].x
    if (runDuration >= minimumMs && isChangedAfterRun) {
      for (let p = runStart; p <= end; p++) {
        overlay[p] = points[p]
      }
    }
    runStart = i
  }

  return overlay
}

function getDefaultZoomWindowMs(range: RangeKey) {
  if (range === '24h') return 4 * 60 * 60_000
  if (range === '7d') return 36 * 60 * 60_000
  if (range === 'months') return 45 * 24 * 60 * 60_000
  return 365 * 24 * 60 * 60_000
}

function applyDefaultZoom(chart: Chart | null, range: RangeKey) {
  if (!chart) return
  const data = chart.data.datasets[0].data as { x: number; y: number }[]
  if (!data.length) return

  const dataMax = data[data.length - 1].x
  const dataMin = data[0].x
  const windowMs = Math.max(getDefaultZoomWindowMs(range), 60_000)
  const min = Math.max(dataMin, dataMax - windowMs)

  setXScaleRange(chart, min, dataMax)

  const zoomOptions = chart.options.plugins?.zoom
  if (zoomOptions?.limits?.x) {
    zoomOptions.limits.x.minRange = windowMs
  }
}

function setXScaleRange(chart: Chart, min: number, max: number) {
  const xScale = chart.options.scales?.x
  if (!xScale || Array.isArray(xScale)) return
  xScale.min = min
  xScale.max = max
}
