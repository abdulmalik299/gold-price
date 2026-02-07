import React from 'react'
import { arrowForDelta, formatMoney, formatPercent } from '../lib/format'
import { deltaAndPercent } from '../lib/calc'
import { fetchTickAtOrBefore } from '../lib/supabase'
import { useI18n } from '../lib/i18n'

type RowKey = 'today' | '30d' | '6m' | '1y' | '5y' | '20y'

type Row = {
  key: RowKey
  label: string
  tsTarget: number
}

function startOfLocalDayMs(nowMs: number) {
  const d = new Date(nowMs)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function minusDays(nowMs: number, days: number) {
  return nowMs - days * 24 * 60 * 60 * 1000
}

function minusMonths(nowMs: number, months: number) {
  const d = new Date(nowMs)
  d.setMonth(d.getMonth() - months)
  return d.getTime()
}

function minusYears(nowMs: number, years: number) {
  const d = new Date(nowMs)
  d.setFullYear(d.getFullYear() - years)
  return d.getTime()
}
export default function LiveOunceCard({
  ounceUsd,
}: {
  ounceUsd: number | null
}) {
  const { t } = useI18n()
  const [todayBase, setTodayBase] = React.useState<number | null>(null)
  const [perfBase, setPerfBase] = React.useState<Record<RowKey, number | null>>({
    today: null,
    '30d': null,
    '6m': null,
    '1y': null,
    '5y': null,
    '20y': null,
  })
  const [dayKey, setDayKey] = React.useState(() => new Date().toDateString())
  const nowMs = Date.now()
  const rows: Row[] = React.useMemo(() => {
    return [
      { key: 'today', label: t('today'), tsTarget: startOfLocalDayMs(nowMs) },
      { key: '30d', label: t('days30'), tsTarget: minusDays(nowMs, 30) },
      { key: '6m', label: t('months6'), tsTarget: minusMonths(nowMs, 6) },
      { key: '1y', label: t('year1'), tsTarget: minusYears(nowMs, 1) },
      { key: '5y', label: t('years5'), tsTarget: minusYears(nowMs, 5) },
      { key: '20y', label: t('years20'), tsTarget: minusYears(nowMs, 20) },
    ]
  }, [nowMs, t])

  React.useEffect(() => {
    const t = window.setInterval(() => {
      const nextKey = new Date().toDateString()
      setDayKey((prevKey) => (prevKey === nextKey ? prevKey : nextKey))
    }, 60_000)
    return () => window.clearInterval(t)
  }, [])

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (ounceUsd == null) return
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const tick = await fetchTickAtOrBefore(start.toISOString())
        if (!alive) return
        setTodayBase(tick?.price ?? null)
      } catch {
        // keep existing baseline
      }
    })()

    return () => {
      alive = false
    }
  }, [dayKey, ounceUsd])

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (ounceUsd == null) return
        const next: Record<RowKey, number | null> = { ...perfBase }
        await Promise.all(
          rows.map(async (r) => {
            const tick = await fetchTickAtOrBefore(new Date(r.tsTarget).toISOString())
            next[r.key] = tick?.price ?? null
          })
        )
        if (!alive) return
        setPerfBase(next)
      } catch {
        // keep existing
      }
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ounceUsd])
  const now = ounceUsd ?? 0
  const { delta, pct } = deltaAndPercent(now, todayBase)
  const { arrow, tone } = arrowForDelta(delta)
  const cls = tone === 'up' ? 'chgUp' : tone === 'down' ? 'chgDown' : 'chgFlat'

  // Animate only when this card mounts (and App.tsx remounts it only on real changes)
  const [pulse, setPulse] = React.useState(true)
  React.useEffect(() => {
    const t = window.setTimeout(() => setPulse(false), 650)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <div className={`card liveOunce ${pulse ? 'pricePulse' : ''} ${cls}`}>
      <div className="cardTop">
        <div className="cardTitle">{t('liveGoldTitle')}</div>
        <div className="pill subtle">{t('perOunce')}</div>
      </div>

      <div className="bigNumber">{ounceUsd == null ? '—' : formatMoney(ounceUsd, 'USD')}</div>

      <div className={`changeRow ${cls}`}>
        <span className="changeLabel">{t('today')}</span>
        <span className="arrow">{arrow}</span>
        <span className="changeAmt">{formatMoney(delta, 'USD')}</span>
        <span className="dotSep">•</span>
        <span className="changePct">{formatPercent(pct)}</span>
      </div>

      <div className="perfMini">
        {rows.map((r) => {
          const prev = perfBase[r.key]
          const { delta: rowDelta, pct: rowPct } = deltaAndPercent(now, prev)
          const { arrow: rowArrow, tone: rowTone } = arrowForDelta(rowDelta)
          const rowCls = rowTone === 'up' ? 'chgUp' : rowTone === 'down' ? 'chgDown' : 'chgFlat'
          const amount = prev == null ? '—' : formatMoney(rowDelta, 'USD', 2)
          const pctTxt = prev == null ? '—' : formatPercent(rowPct)

          return (
            <div className="perfMiniRow" key={r.key}>
              <span className="perfMiniLabel">{r.label}</span>
              <span className={`perfMiniAmt ${rowCls}`}>
                <span className="arrow">{rowArrow}</span> {amount}
              </span>
              <span className={`perfMiniPct ${rowCls}`}>{pctTxt}</span>
            </div>
          )
        })}
      </div>

      <div className="mutedTiny">{t('showsChangeSinceMidnight')}</div>
    </div>
  )
}
