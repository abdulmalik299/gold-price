import React from 'react'
import { fetchTicks, type GoldTick } from '../lib/supabase'
import { formatMoney } from '../lib/format'
import { useI18n } from '../lib/i18n'

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

type ChartWithMeta = Chart & {
  $precisionMode?: boolean
  $lastPrice?: { price: number; label: string } | null
  $isRtl?: boolean
}

const TIME_FORMATTERS = {
  hour: new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }),
  day: new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short' }),
  month: new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }),
  year: new Intl.DateTimeFormat(undefined, { year: 'numeric' }),
  dateTime: new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
}

// Crosshair (+ ruler) plugin
const crosshairPlugin = {
  id: 'luxCrosshair',
  afterDraw(chart: ChartWithMeta) {
    if (!chart.$precisionMode) return
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

const lastPricePlugin = {
  id: 'luxLastPrice',
  afterDatasetsDraw(chart: ChartWithMeta) {
    const lastPrice = chart.$lastPrice
    if (!lastPrice) return
    const yScale = chart.scales.y
    const { chartArea } = chart
    if (!yScale || !chartArea) return
    const y = yScale.getPixelForValue(lastPrice.price)
    if (!Number.isFinite(y)) return

    const ctx = chart.ctx
    ctx.save()
    ctx.strokeStyle = 'rgba(247, 215, 122, 0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(chartArea.left, y)
    ctx.lineTo(chartArea.right, y)
    ctx.stroke()
    ctx.setLineDash([])

    const label = lastPrice.label
    ctx.font = '600 11px system-ui, -apple-system, sans-serif'
    const paddingX = 6
    const paddingY = 4
    const textWidth = ctx.measureText(label).width
    const boxWidth = textWidth + paddingX * 2
    const boxHeight = 18
    const isRtl = Boolean(chart.$isRtl)
    const boxX = isRtl ? chartArea.left + 6 : chartArea.right - boxWidth - 6
    const boxY = y - boxHeight / 2

    ctx.fillStyle = 'rgba(10, 12, 18, 0.75)'
    ctx.strokeStyle = 'rgba(247, 215, 122, 0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = 'rgba(255, 243, 196, 0.9)'
    ctx.textBaseline = 'middle'
    ctx.textAlign = isRtl ? 'right' : 'left'
    const textX = isRtl ? boxX + boxWidth - paddingX : boxX + paddingX
    ctx.fillText(label, textX, boxY + boxHeight / 2)
    ctx.restore()
  },
}

ChartJS.register(lastPricePlugin)

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
  const { t, lang } = useI18n()
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)
  const chartRef = React.useRef<Chart | null>(null)
  const workerRef = React.useRef<Worker | null>(null)
  const [chartNow, setChartNow] = React.useState(() => new Date())

  const [range, setRange] = React.useState<RangeKey>('24h')
  const rangeItems = React.useMemo(
    () => [
      { key: '24h', label: t('range24h') },
      { key: '7d', label: t('range7d') },
      { key: 'months', label: t('rangeMonths') },
      { key: 'years', label: t('rangeYears') },
    ] as const,
    [t]
  )
  const [loading, setLoading] = React.useState(false)
  const [lastPoint, setLastPoint] = React.useState<{ ts: number; price: number } | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [isFollowingLive, setIsFollowingLive] = React.useState(true)
  const userInteractedRef = React.useRef(false)
  const isFollowingLiveRef = React.useRef(true)
  const precisionModeRef = React.useRef(false)
  const latestPointRef = React.useRef<{ ts: number; price: number } | null>(null)
  const rangeRef = React.useRef(range)
  const lastRangeRef = React.useRef(range)
  const isMiddlePanRef = React.useRef(false)
  const middlePanPosRef = React.useRef<{ x: number; y: number } | null>(null)
  const longPressTimerRef = React.useRef<number | null>(null)
  const lastTapRef = React.useRef<number>(0)
  const setPanMode = React.useCallback((chart: Chart, mode: 'x' | 'xy') => {
    const zoomOptions = chart.options.plugins?.zoom
    if (!zoomOptions?.pan) return
    zoomOptions.pan.mode = mode
  }, [])

  React.useEffect(() => {
    const id = window.setInterval(() => setChartNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])


  const setFollowLive = React.useCallback((next: boolean) => {
    isFollowingLiveRef.current = next
    setIsFollowingLive(next)
    if (next) {
      userInteractedRef.current = false
    }
  }, [])

  const updateFollowState = React.useCallback((chart: Chart, latestTs?: number | null) => {
    if (!latestTs) return
    const xScale = chart.scales.x
    if (!xScale || !Number.isFinite(xScale.min) || !Number.isFinite(xScale.max)) return
    const span = xScale.max - xScale.min
    const nearLatest = Math.abs(xScale.max - latestTs) < Math.max(30_000, span * 0.03)
    setFollowLive(nearLatest)
    userInteractedRef.current = !nearLatest
  }, [range, setFollowLive])

  const setPrecisionMode = React.useCallback((enabled: boolean) => {
    precisionModeRef.current = enabled
    if (chartRef.current) {
      ;(chartRef.current as ChartWithMeta).$precisionMode = enabled
      chartRef.current.update('none')
    }
  }, [setPanMode, updateFollowState])
  
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
    latestPointRef.current = last ? { ts: last.x, price: last.y } : null
    
    const ctx = canvasRef.current.getContext('2d')!
    if (!chartRef.current) {
      const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'touchend', 'mousedown', 'mouseup', 'wheel'],
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
              title: (ctx) => {
                if (!ctx[0]) return ''
                const parsedX = ctx[0].parsed.x
                if (parsedX == null) return ''
                if (precisionModeRef.current) {
                  return TIME_FORMATTERS.dateTime.format(new Date(parsedX))
                }
                return TIME_FORMATTERS.dateTime.format(new Date(parsedX))
              },
              label: (ctx) => ` ${formatMoney(ctx.parsed.y, 'USD')}`,
            },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              onPanStart: ({ chart, event }) => {
                const nativeEvent = (event as unknown as { native?: Event; srcEvent?: Event })?.native
                  ?? (event as unknown as { srcEvent?: Event })?.srcEvent
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
                setFollowLive(false)
              },
              onPanComplete: ({ chart }) => {
                updateFollowState(chart, latestPointRef.current?.ts ?? null)
              },
            },
            zoom: {
              wheel: { enabled: true, speed: 0.08 },
              pinch: { enabled: true },
              mode: 'x',
              onZoom: () => {
                userInteractedRef.current = true
                setFollowLive(false)
              },
              onZoomComplete: ({ chart }) => {
                updateFollowState(chart, latestPointRef.current?.ts ?? null)
              },
            },
            limits: {
              x: {
                min: 'original',
                max: 'original',
                minRange: 60_000,
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
              autoSkipPadding: 24,
              callback(value) {
                const scale = this as any
                const min = scale.min
                const max = scale.max
                const span = Number.isFinite(min) && Number.isFinite(max) ? max - min : null
                return formatTimeTick(value, rangeRef.current, span ?? undefined)
              },
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
              label: t('goldLabel'),
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
              label: t('staleLabel'),
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
      const chartWithMeta = chartRef.current as ChartWithMeta
      chartWithMeta.$precisionMode = precisionModeRef.current
      chartWithMeta.$lastPrice = last ? { price: last.y, label: `${formatMoney(last.y, 'USD')}` } : null
      chartWithMeta.$isRtl = lang !== 'en'
      applyDefaultZoom(chartRef.current)
      return
    }

    const ch = chartRef.current as ChartWithMeta
    const prevScale = ch.scales.x
    const prevMin = Number.isFinite(prevScale?.min) ? prevScale.min : null
    const prevMax = Number.isFinite(prevScale?.max) ? prevScale.max : null
    const prevSpan = prevMin != null && prevMax != null ? prevMax - prevMin : null
    const prevData = ch.data.datasets[0].data as { x: number; y: number }[]
    const prevDataMax = prevData.length ? prevData[prevData.length - 1].x : null
    const didRangeChange = lastRangeRef.current !== range
    
    ch.data.datasets[0].data = data as any
    ch.data.datasets[1].data = staleOverlayData as any
    lastRangeRef.current = range
    
    if (prevMin != null && prevMax != null && prevSpan != null && prevDataMax != null && data.length) {
      const newDataMax = data[data.length - 1].x
      const isFollowingLatest = Math.abs(prevDataMax - prevMax) < Math.max(30_000, prevSpan * 0.03)
      const max = isFollowingLiveRef.current || (!userInteractedRef.current && isFollowingLatest) ? newDataMax : prevMax
      const min = max - prevSpan
      setXScaleRange(ch, min, max)
      if (max === newDataMax && !isFollowingLiveRef.current) {
        setFollowLive(true)
      }
    }
    if (didRangeChange || isFollowingLiveRef.current) {
      applyDefaultZoom(ch)
    }
    ch.$isRtl = lang !== 'en'
    if (last?.y != null) {
      ch.$lastPrice = { price: last.y, label: `${formatMoney(last.y, 'USD')}` }
    } else {
      ch.$lastPrice = null
    }
    ch.update()
  }, [lang, range, setFollowLive, setPanMode, t])

  const load = React.useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const ticks = await fetchTicks(range)
      await setData(ticks)
    } catch (e: any) {
      setErr(e?.message ?? t('failedToLoadHistory'))
    } finally {
      setLoading(false)
    }
  }, [range, setData, t])

  React.useEffect(() => {
    load()
  }, [load])

  React.useEffect(() => {
    rangeRef.current = range
    setFollowLive(true)
  }, [range, setFollowLive])

  React.useEffect(() => {
    const chart = chartRef.current as ChartWithMeta | null
    if (!chart) return
    chart.$isRtl = lang !== 'en'
    chart.update('none')
  }, [lang])

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
    setFollowLive(true)
    applyDefaultZoom(chartRef.current)
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
    if (!chartRef.current) return
    chartRef.current.data.datasets[0].label = t('goldLabel')
    chartRef.current.data.datasets[1].label = t('staleLabel')
    chartRef.current.update('none')
  }, [t])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 1) return
      isMiddlePanRef.current = true
      middlePanPosRef.current = { x: event.clientX, y: event.clientY }
      const chart = chartRef.current
      if (chart) setPanMode(chart, 'xy')
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
      const chart = chartRef.current
      if (chart) {
        setPanMode(chart, 'x')
        updateFollowState(chart, latestPointRef.current?.ts ?? null)
      }
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
  }, [setPanMode, updateFollowState])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey) setPrecisionMode(true)
    }
    const handleKeyUp = () => {
      setPrecisionMode(false)
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setPrecisionMode])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      const now = Date.now()
      if (now - lastTapRef.current < 280) {
        resetZoom()
        lastTapRef.current = 0
        return
      }
      lastTapRef.current = now
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = window.setTimeout(() => {
        setPrecisionMode(true)
      }, 350)
    }

    const handlePointerUp = () => {
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
      setPrecisionMode(false)
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointercancel', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointercancel', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [resetZoom, setPrecisionMode])

  const handleBackToLive = React.useCallback(() => {
    setFollowLive(true)
    applyDefaultZoom(chartRef.current)
    chartRef.current?.update()
  }, [setFollowLive])

  return (
    <div className="card chart">
      <div className="cardTop">
        <div className="cardTitle">{t('historyChartTitle')}</div>
        <div className="inlineRight chartControls">
          <div className="rangeBtns">
            {rangeItems.map((it) => (
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
          {!isFollowingLive && (
            <button type="button" className="chip chipLive" onClick={handleBackToLive}>
              <span className="chipGlow" />
              {t('backToLive')}
            </button>
          )}
          <button type="button" className="chip" onClick={resetZoom}>
            <span className="chipGlow" />
            {t('resetZoom')}
          </button>
        </div>
      </div>

      <div className="chartMeta">
        <div className="pill subtle">
          {loading
            ? t('loading')
            : err
              ? t('errorPrefix', { message: err })
              : lastPoint
                ? t('lastLabel', {
                  price: formatMoney(lastPoint.price, 'USD'),
                  time: new Date(lastPoint.ts).toLocaleString(lang),
                })
                : t('noDataYet')}
        </div>
        <div className="mutedTiny">
          {t('chartHelp')}
        </div>
      </div>

      <div className="chartWrap">
        <canvas ref={canvasRef} className="chartCanvas" />
      </div>

      <div className="chartFooter">
        <div className="chartClock">
          {chartNow.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div className="chartDate">
          {chartNow.toLocaleDateString(lang, { month: 'long', day: '2-digit', year: 'numeric' })}
        </div>
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

function applyDefaultZoom(chart: Chart | null) {
  if (!chart) return
  const data = chart.data.datasets[0].data as { x: number; y: number }[]
  if (!data.length) return

  const dataMax = data[data.length - 1].x
  const dataMin = data[0].x
  setXScaleRange(chart, dataMin, dataMax)

  const zoomOptions = chart.options.plugins?.zoom
  if (zoomOptions?.limits?.x) {
    zoomOptions.limits.x.minRange = 60_000
  }
}

function setXScaleRange(chart: Chart, min: number, max: number) {
  const xScale = chart.options.scales?.x
  if (!xScale || Array.isArray(xScale)) return
  xScale.min = min
  xScale.max = max
}

function formatTimeTick(value: string | number, range: RangeKey, spanMs?: number) {
  const time = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(time)) return ''
  const span = spanMs ?? getDefaultZoomWindowMs(range)
  if (span <= 36 * 60 * 60_000 || range === '24h') {
    return TIME_FORMATTERS.hour.format(new Date(time))
  }
  if (span <= 21 * 24 * 60 * 60_000 || range === '7d') {
    return TIME_FORMATTERS.day.format(new Date(time))
  }
  if (span <= 420 * 24 * 60 * 60_000) {
    return TIME_FORMATTERS.month.format(new Date(time))
  }
  return TIME_FORMATTERS.year.format(new Date(time))
}
