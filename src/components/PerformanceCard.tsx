import React from 'react'
import { arrowForDelta, formatMoney, formatPercent } from '../lib/format'
import { deltaAndPercent } from '../lib/calc'
import { fetchTickAtOrBefore } from '../lib/supabase'
import { getLastMarketOpenMs } from '../lib/marketTime'
import { useI18n } from '../lib/i18n'

type RowKey = 'lastDay' | '7d' | '30d' | '6m' | '1y' | '5y' | '20y'

type Row = {
  key: RowKey
  label: string
  tsTarget: number
}

type LastDaySnapshot = {
  startPrice: number | null
  endPrice: number | null
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

export default function PerformanceCard({ ounceUsd }: { ounceUsd: number | null }) {
  const { t } = useI18n()
  const [base, setBase] = React.useState<Record<RowKey, number | null>>({
    lastDay: null,
    '7d': null,
    '30d': null,
    '6m': null,
    '1y': null,
    '5y': null,
    '20y': null,
  })
  const [lastDaySnapshot, setLastDaySnapshot] = React.useState<LastDaySnapshot>({
    startPrice: null,
    endPrice: null,
  })
  const [sessionKey, setSessionKey] = React.useState(() => new Date(getLastMarketOpenMs()).toISOString())

  const rows: Row[] = React.useMemo(() => {
    const nowMs = Date.now()
    const sessionStart = new Date(sessionKey).getTime()
    return [
      { key: 'lastDay', label: t('lastDay'), tsTarget: sessionStart },
      { key: '7d', label: t('days7'), tsTarget: minusDays(nowMs, 7) },
      { key: '30d', label: t('days30'), tsTarget: minusDays(nowMs, 30) },
      { key: '6m', label: t('months6'), tsTarget: minusMonths(nowMs, 6) },
      { key: '1y', label: t('year1'), tsTarget: minusYears(nowMs, 1) },
      { key: '5y', label: t('years5'), tsTarget: minusYears(nowMs, 5) },
      { key: '20y', label: t('years20'), tsTarget: minusYears(nowMs, 20) },
    ]
  }, [sessionKey, t])

  React.useEffect(() => {
    const t = window.setInterval(() => {
      const nextKey = new Date(getLastMarketOpenMs()).toISOString()
      setSessionKey((prevKey) => (prevKey === nextKey ? prevKey : nextKey))
    }, 60_000)
    return () => window.clearInterval(t)
  }, [])

  React.useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const sessionStartMs = new Date(sessionKey).getTime()
        const prevSessionStartMs = getLastMarketOpenMs(sessionStartMs - 1)

        const [prevSessionTick, currentSessionTick] = await Promise.all([
          fetchTickAtOrBefore(new Date(prevSessionStartMs).toISOString()),
          fetchTickAtOrBefore(new Date(sessionStartMs).toISOString()),
        ])

        if (!alive) return
        setLastDaySnapshot({
          startPrice: prevSessionTick?.price ?? null,
          endPrice: currentSessionTick?.price ?? null,
        })

        const next: Record<RowKey, number | null> = {
          lastDay: prevSessionTick?.price ?? null,
          '7d': null,
          '30d': null,
          '6m': null,
          '1y': null,
          '5y': null,
          '20y': null,
        }

        // Fetch each baseline: the latest tick at or before the target time.
        // (This makes it stable and NOT "previous poll" based.)
        await Promise.all(
          rows
            .filter((r) => r.key !== 'lastDay')
            .map(async (r) => {
              const tick = await fetchTickAtOrBefore(new Date(r.tsTarget).toISOString())
              next[r.key] = tick?.price ?? null
            })
        )

        if (!alive) return
        setBase(next)
      } catch {
        // keep existing
      }
    })()

    return () => {
      alive = false
    }
    // Recompute only when market price changes (not on every rerender)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ounceUsd, rows])

  return (
    <div className="card perf">
      <div className="cardTop">
        <div className="cardTitle">Gold Price Performance (USD)</div>
        <div className="pill subtle">Change</div>
      </div>

      <div className="perfTable">
        <div className="perfHead">
          <div>Change</div>
          <div className="right">Amount</div>
          <div className="right">%</div>
        </div>

        {rows.map((r) => {
          const prev = r.key === 'lastDay' ? lastDaySnapshot.startPrice : base[r.key]
          const curr = r.key === 'lastDay' ? lastDaySnapshot.endPrice : ounceUsd

          if (curr == null || prev == null) {
            return (
              <div className="perfRow" key={r.key}>
                <div className="perfLabel">{r.label}</div>
                <div className="perfAmt right chgFlat">
                  <span className="arrow">→</span> —
                </div>
                <div className="perfPct right chgFlat">—</div>
              </div>
            )
          }

          const { delta, pct } = deltaAndPercent(curr, prev)
          const { arrow, tone } = arrowForDelta(delta)
          const cls = tone === 'up' ? 'chgUp' : tone === 'down' ? 'chgDown' : 'chgFlat'

          const amount = formatMoney(delta, 'USD', 2)
          const pctTxt = formatPercent(pct)

          return (
            <div className="perfRow" key={r.key}>
              <div className="perfLabel">{r.label}</div>
              <div className={`perfAmt right ${cls}`}>
                <span className="arrow">{arrow}</span> {amount}
              </div>
              <div className={`perfPct right ${cls}`}>{pctTxt}</div>
            </div>
          )
        })}
      </div>

      <div className="mutedTiny">
        Uses your Supabase history as baseline (so it won’t reset every poll). Rows show “—” until enough history exists.
      </div>
    </div>
  )
}
