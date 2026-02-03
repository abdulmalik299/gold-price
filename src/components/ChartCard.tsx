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
  }, [range])

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

  async function setData(ticks: GoldTick[]) {
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
            pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'x',
            },
            limits: { x: { min: 'original', max: 'original' } },
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
          ],
        },
        options,
      })
      return
    }

    const ch = chartRef.current
    ch.data.datasets[0].data = data as any
    ch.update('none')
  }

  function resetZoom() {
    const ch = chartRef.current as any
    if (!ch) return
    if (typeof ch.resetZoom === 'function') ch.resetZoom()
  }

  React.useEffect(() => {
    return () => {
      chartRef.current?.destroy()
      chartRef.current = null
      workerRef.current?.terminate()
      workerRef.current = null
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
        <div className="mutedTiny">Mouse wheel = zoom. Hold <b>Shift</b> + drag to pan. Move cursor for “+ ruler”.</div>
      </div>

      <div className="chartWrap">
        <canvas ref={canvasRef} />
        <div className="priceRail">
          <div className="priceRailTitle">Price</div>
          <div className="priceRailHint">Scroll wheel here to zoom too.</div>
        </div>
      </div>

      <div className="mutedTiny">
        The chart reads from Supabase. It will contain points even if the website was closed, because the Edge Function stores changes.
      </div>
    </div>
  )
}
