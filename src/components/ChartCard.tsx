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

type ChartWithMeta = Chart & {
  $precisionMode?: boolean
  $lastPrice?: { price: number; label: string } | null
  $isRtl?: boolean
}

type RangePreset = '1D' | '1W' | '1M' | '3M' | 'ALL'

type ViewStats = {
  high: number
  low: number
  change: number
  changePct: number
  volatilityPct: number
}

const TIME_FORMATTERS = new Map<string, ReturnType<typeof buildTimeFormatters>>()

function buildTimeFormatters(locale?: string) {
  return {
    hour: new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    day: new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: 'short' }),
    month: new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }),
    year: new Intl.DateTimeFormat(locale, { year: 'numeric' }),
    dateLong: new Intl.DateTimeFormat(locale, { month: 'long', day: '2-digit', year: 'numeric' }),
    dateTime: new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
  }
}

function getTimeFormatters(locale?: string) {
  const key = locale ?? 'default'
  const existing = TIME_FORMATTERS.get(key)
  if (existing) return existing
  const next = buildTimeFormatters(locale)
  TIME_FORMATTERS.set(key, next)
  return next
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
  const langRef = React.useRef(lang)

  const [loading, setLoading] = React.useState(false)
  const [lastPoint, setLastPoint] = React.useState<{ ts: number; price: number } | null>(null)
  const [err, setErr] = React.useState<string | null>(null)
  const [isFollowingLive, setIsFollowingLive] = React.useState(true)
  const [showEma, setShowEma] = React.useState(true)
  const [showSma, setShowSma] = React.useState(false)
  const [showTrendColors, setShowTrendColors] = React.useState(true)
  const [priceScale, setPriceScale] = React.useState<'linear' | 'logarithmic'>('linear')
  const [rangePreset, setRangePreset] = React.useState<RangePreset>('ALL')
  const [viewStats, setViewStats] = React.useState<ViewStats | null>(null)
  const userInteractedRef = React.useRef(false)
  const isFollowingLiveRef = React.useRef(true)
  const precisionModeRef = React.useRef(false)
  const latestPointRef = React.useRef<{ ts: number; price: number } | null>(null)
  const longPressTimerRef = React.useRef<number | null>(null)
  const lastTapRef = React.useRef<number>(0)
  const workerRequestIdRef = React.useRef(0)

  React.useEffect(() => {
    const id = window.setInterval(() => setChartNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  React.useEffect(() => {
    langRef.current = lang
  }, [lang])


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
  }, [setFollowLive])

  const setPrecisionMode = React.useCallback((enabled: boolean) => {
    precisionModeRef.current = enabled
    if (chartRef.current) {
      (chartRef.current as ChartWithMeta).$precisionMode = enabled
      chartRef.current.update('none')
    }
  }, [])

  const updateStatsFromRange = React.useCallback((chart: Chart) => {
    const series = chart.data.datasets[0].data as { x: number; y: number }[]
    if (!series.length) {
      setViewStats(null)
      return
    }
    const xScale = chart.scales.x
    const min = Number.isFinite(xScale?.min) ? xScale.min : series[0].x
    const max = Number.isFinite(xScale?.max) ? xScale.max : series[series.length - 1].x
    const visible = series.filter((point) => point.x >= min && point.x <= max)
    const points = visible.length >= 2 ? visible : series
    setViewStats(calculateViewStats(points))
  }, [])
  
  const setData = React.useCallback(async (ticks: GoldTick[]) => {
    if (!canvasRef.current) return
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('../workers/chartWorker.ts', import.meta.url), { type: 'module' })
    }
    const worker = workerRef.current

    workerRequestIdRef.current += 1
    const requestId = workerRequestIdRef.current
    const prepared = await new Promise<{ prepared: { x: number; y: number }[]; requestId?: number }>((resolve) => {
      const onMsg = (ev: MessageEvent<{ prepared: { x: number; y: number }[]; requestId?: number }>) => {
        if (ev.data?.requestId !== requestId) return
        worker.removeEventListener('message', onMsg as any)
        resolve(ev.data)
      }
      worker.addEventListener('message', onMsg as any)
      worker.postMessage({ ticks: ticks.map((t) => ({ ts: t.ts, price: t.price })), requestId })
    })

    const data = prepared.prepared
    const emaData = buildEma(data, 20)
    const smaData = buildSma(data, 50)
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
          decimation: {
            enabled: true,
            algorithm: 'lttb',
            samples: 500,
          },
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
                const formatters = getTimeFormatters(langRef.current)
                return formatters.dateTime.format(new Date(parsedX))
              },
              label: (ctx) => ` ${formatMoney(ctx.parsed.y, 'USD')}`,
              footer: (ctx) => {
                if (!ctx.length) return ''
                const dataset = ctx[0].dataset.data as { x: number; y: number }[]
                const idx = ctx[0].dataIndex
                const previous = idx > 0 ? dataset[idx - 1] : null
                if (!previous) return ''
                const currentY = ctx[0].parsed.y
                if (currentY == null) return ''
                const change = currentY - previous.y
                const pct = previous.y !== 0 ? (change / previous.y) * 100 : 0
                const sign = change >= 0 ? '+' : ''
                return `${sign}${formatMoney(change, 'USD')} (${sign}${pct.toFixed(2)}%)`
              },
            },
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              onPan: () => {
                userInteractedRef.current = true
                setFollowLive(false)
              },
              onPanComplete: ({ chart }) => {
                updateFollowState(chart, latestPointRef.current?.ts ?? null)
                updateStatsFromRange(chart)
                setRangePreset('ALL')
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
                updateStatsFromRange(chart)
                setRangePreset('ALL')
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
                return formatTimeTick(value, span ?? undefined, langRef.current)
              },
            },
          },
          y: {
            type: 'linear',
            grid: { color: 'rgba(255,255,255,0.06)' },
            position: 'right',
            ticks: {
              color: 'rgba(255,255,255,0.55)',
              padding: 10,
            },
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
              segment: {
                borderColor: (ctx) => {
                  if (!showTrendColors) return 'rgba(247, 215, 122, 0.95)'
                  const up = (ctx.p1.parsed.y ?? 0) >= (ctx.p0.parsed.y ?? 0)
                  return up ? 'rgba(78, 232, 167, 0.95)' : 'rgba(255, 124, 124, 0.95)'
                },
              },
              fill: true,
              backgroundColor: (c) => buildGradient(c.chart.ctx, c.chart),
            },
            {
              label: 'EMA (20)',
              data: emaData,
              parsing: false,
              borderWidth: 1.6,
              pointRadius: 0,
              pointHitRadius: 0,
              tension: 0.3,
              borderColor: 'rgba(99, 179, 255, 0.85)',
              fill: false,
              hidden: !showEma,
            },
            {
              label: 'SMA (50)',
              data: smaData,
              parsing: false,
              borderWidth: 1.6,
              pointRadius: 0,
              pointHitRadius: 0,
              tension: 0.18,
              borderColor: 'rgba(202, 137, 255, 0.8)',
              borderDash: [6, 5],
              fill: false,
              hidden: !showSma,
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
      updateStatsFromRange(chartRef.current)
      return
    }

    const ch = chartRef.current as ChartWithMeta
    const prevScale = ch.scales.x
    const prevMin = Number.isFinite(prevScale?.min) ? prevScale.min : null
    const prevMax = Number.isFinite(prevScale?.max) ? prevScale.max : null
    const prevSpan = prevMin != null && prevMax != null ? prevMax - prevMin : null
    const prevData = ch.data.datasets[0].data as { x: number; y: number }[]
    const prevDataMax = prevData.length ? prevData[prevData.length - 1].x : null
    ch.data.datasets[0].data = data as any
    ch.data.datasets[1].data = emaData as any
    ch.data.datasets[1].hidden = !showEma
    ch.data.datasets[2].data = smaData as any
    ch.data.datasets[2].hidden = !showSma
    ch.data.datasets[3].data = staleOverlayData as any
    
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
    if (isFollowingLiveRef.current) {
      applyDefaultZoom(ch)
    }
    ch.$isRtl = lang !== 'en'
    if (last?.y != null) {
      ch.$lastPrice = { price: last.y, label: `${formatMoney(last.y, 'USD')}` }
    } else {
      ch.$lastPrice = null
    }
    ch.update()
    updateStatsFromRange(ch)
  }, [lang, setFollowLive, showEma, showSma, showTrendColors, t, updateFollowState, updateStatsFromRange])

  const load = React.useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const ticks = await fetchTicks()
      await setData(ticks)
    } catch (e: any) {
      setErr(e?.message ?? t('failedToLoadHistory'))
    } finally {
      setLoading(false)
    }
  }, [setData, t])

  React.useEffect(() => {
    load()
  }, [load])

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

  const resetZoom = React.useCallback(() => {
    const ch = chartRef.current as any
    if (!ch) return
    if (typeof ch.resetZoom === 'function') ch.resetZoom()
    userInteractedRef.current = false
    setFollowLive(true)
    applyDefaultZoom(chartRef.current)
    chartRef.current?.update()
    if (chartRef.current) updateStatsFromRange(chartRef.current)
    setRangePreset('ALL')
  }, [setFollowLive, updateStatsFromRange])

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
    chartRef.current.data.datasets[1].label = t('emaLabel')
    chartRef.current.data.datasets[2].label = 'SMA (50)'
    chartRef.current.data.datasets[3].label = t('staleLabel')
    chartRef.current.update('none')
  }, [t])

  React.useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.data.datasets[1].hidden = !showEma
    chartRef.current.update('none')
  }, [showEma])

  React.useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.data.datasets[2].hidden = !showSma
    chartRef.current.update('none')
  }, [showSma])

  React.useEffect(() => {
    if (!chartRef.current) return
    chartRef.current.update('none')
  }, [showTrendColors])

  React.useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    const yScale = chart.options.scales?.y
    if (!yScale || Array.isArray(yScale)) return
    yScale.type = priceScale
    chart.update()
  }, [priceScale])

  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handlePointerUp = () => {
      const chart = chartRef.current
      if (chart) updateFollowState(chart, latestPointRef.current?.ts ?? null)
    }

    canvas.addEventListener('mouseup', handlePointerUp)
    canvas.addEventListener('mouseleave', handlePointerUp)

    return () => {
      canvas.removeEventListener('mouseup', handlePointerUp)
      canvas.removeEventListener('mouseleave', handlePointerUp)
    }
  }, [updateFollowState])

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
    if (chartRef.current) updateStatsFromRange(chartRef.current)
    setRangePreset('ALL')
  }, [setFollowLive, updateStatsFromRange])

  const applyRangePreset = React.useCallback((preset: RangePreset) => {
    const chart = chartRef.current
    if (!chart) return
    const points = chart.data.datasets[0].data as { x: number; y: number }[]
    if (!points.length) return

    const max = points[points.length - 1].x
    const spanByPreset: Record<Exclude<RangePreset, 'ALL'>, number> = {
      '1D': 24 * 60 * 60_000,
      '1W': 7 * 24 * 60 * 60_000,
      '1M': 30 * 24 * 60 * 60_000,
      '3M': 90 * 24 * 60 * 60_000,
    }

    if (preset === 'ALL') {
      setFollowLive(true)
      applyDefaultZoom(chart)
    } else {
      const min = Math.max(points[0].x, max - spanByPreset[preset])
      setXScaleRange(chart, min, max)
      setFollowLive(true)
    }

    chart.update()
    updateStatsFromRange(chart)
    setRangePreset(preset)
  }, [setFollowLive, updateStatsFromRange])

  return (
    <div className="card chart">
      <div className="cardTop">
        <div className="cardTitle">{t('historyChartTitle')}</div>
        <div className="inlineRight chartControls">
          <div className="rangeBtns">
            {([
              { value: '1D', label: t('chartRange1D') },
              { value: '1W', label: t('chartRange1W') },
              { value: '1M', label: t('chartRange1M') },
              { value: '3M', label: t('chartRange3M') },
              { value: 'ALL', label: t('chartRangeALL') },
            ] as const).map((preset) => (
              <button
                key={preset.value}
                type="button"
                className={`chip ${rangePreset === preset.value ? 'chipOn' : ''}`}
                onClick={() => applyRangePreset(preset.value)}
              >
                <span className="chipGlow" />
                {preset.label}
              </button>
            ))}
          </div>
          <button type="button" className={`chip ${showEma ? 'chipOn' : ''}`} onClick={() => setShowEma((v) => !v)}>
            <span className="chipGlow" />
            {t('emaShort')}
          </button>
          <button type="button" className={`chip ${showTrendColors ? 'chipOn' : ''}`} onClick={() => setShowTrendColors((v) => !v)}>
            <span className="chipGlow" />
            {t('trendColors')}
          </button>
          <button type="button" className={`chip ${showSma ? 'chipOn' : ''}`} onClick={() => setShowSma((v) => !v)}>
            <span className="chipGlow" />
            {t('smaShort')}
          </button>
          <button type="button" className="chip" onClick={() => setPriceScale((v) => (v === 'linear' ? 'logarithmic' : 'linear'))}>
            <span className="chipGlow" />
            {t('priceScale')}: {priceScale === 'linear' ? t('scaleLinear') : t('scaleLog')}
          </button>
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

      {viewStats && (
        <div className="chartStatsGrid">
          <div className="chartStatBox">
            <div className="chartStatLabel">{t('chartHigh')}</div>
            <div className="chartStatValue">{formatMoney(viewStats.high, 'USD')}</div>
          </div>
          <div className="chartStatBox">
            <div className="chartStatLabel">{t('chartLow')}</div>
            <div className="chartStatValue">{formatMoney(viewStats.low, 'USD')}</div>
          </div>
          <div className="chartStatBox">
            <div className="chartStatLabel">{t('chartChange')}</div>
            <div className={`chartStatValue ${viewStats.change >= 0 ? 'up' : 'down'}`}>
              {viewStats.change >= 0 ? '+' : ''}{formatMoney(viewStats.change, 'USD')} ({viewStats.change >= 0 ? '+' : ''}{viewStats.changePct.toFixed(2)}%)
            </div>
          </div>
          <div className="chartStatBox">
            <div className="chartStatLabel">{t('chartVolatility')}</div>
            <div className="chartStatValue">{viewStats.volatilityPct.toFixed(2)}%</div>
          </div>
        </div>
      )}

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

function calculateViewStats(points: { x: number; y: number }[]): ViewStats {
  const prices = points.map((point) => point.y)
  const high = Math.max(...prices)
  const low = Math.min(...prices)
  const first = points[0].y
  const last = points[points.length - 1].y
  const change = last - first
  const changePct = first !== 0 ? (change / first) * 100 : 0
  const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length
  const variance = prices.reduce((sum, price) => sum + (price - mean) ** 2, 0) / prices.length
  const volatilityPct = mean !== 0 ? (Math.sqrt(variance) / mean) * 100 : 0
  return { high, low, change, changePct, volatilityPct }
}

function buildStaleOverlay(points: { x: number; y: number }[], minimumMs = 5 * 60_000) {
  if (points.length < 2) return []

  const overlay = Array.from({ length: points.length }, () => ({ x: NaN, y: NaN }))
  let runStart = 0

  for (let i = 1; i <= points.length; i++) {
    const sameAsStart = i < points.length && points[i].y === points[runStart].y
    if (sameAsStart) continue

    const end = i - 1
    const runDuration = points[end].x - points[runStart].x
    if (runDuration >= minimumMs) {
      for (let p = runStart; p <= end; p++) {
        overlay[p] = points[p]
      }
    }
    runStart = i
  }

  return overlay
}

function buildEma(points: { x: number; y: number }[], period: number) {
  if (!points.length || period < 2) return []
  const multiplier = 2 / (period + 1)
  const ema: { x: number; y: number }[] = []
  let prev = points[0].y
  for (const point of points) {
    prev = (point.y - prev) * multiplier + prev
    ema.push({ x: point.x, y: prev })
  }
  return ema
}


function buildSma(points: { x: number; y: number }[], period: number) {
  if (!points.length || period < 2) return []
  const sma: { x: number; y: number }[] = []
  let rollingSum = 0

  for (let i = 0; i < points.length; i++) {
    rollingSum += points[i].y
    if (i >= period) {
      rollingSum -= points[i - period].y
    }
    const window = Math.min(i + 1, period)
    sma.push({ x: points[i].x, y: rollingSum / window })
  }

  return sma
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

function formatTimeTick(value: string | number, spanMs: number | undefined, locale?: string) {
  const time = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(time)) return ''
  const formatters = getTimeFormatters(locale)
  const span = spanMs && spanMs > 0 ? spanMs : 365 * 24 * 60 * 60_000
  if (span <= 36 * 60 * 60_000) {
    const date = new Date(time)
    return [formatters.hour.format(date), formatters.dateLong.format(date)]
  }
  if (span <= 21 * 24 * 60 * 60_000) {
    return formatters.day.format(new Date(time))
  }
  if (span <= 420 * 24 * 60 * 60_000) {
    return formatters.month.format(new Date(time))
  }
  return formatters.year.format(new Date(time))
}
