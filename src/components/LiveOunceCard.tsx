import React from 'react'
import { arrowForDelta, formatMoney, formatPercent } from '../lib/format'
import { deltaAndPercent } from '../lib/calc'
import { fetchTickAtOrBefore } from '../lib/supabase'
export default function LiveOunceCard({
  ounceUsd,
}: {
  ounceUsd: number | null
}) {
    const [todayBase, setTodayBase] = React.useState<number | null>(null)
  const [dayKey, setDayKey] = React.useState(() => new Date().toDateString())

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
        <div className="cardTitle">Live Gold (XAU)</div>
        <div className="pill subtle">per ounce</div>
      </div>

      <div className="bigNumber">{ounceUsd == null ? '—' : formatMoney(ounceUsd, 'USD')}</div>

      <div className={`changeRow ${cls}`}>
        <span className="changeLabel">Today</span>
        <span className="arrow">{arrow}</span>
        <span className="changeAmt">{formatMoney(delta, 'USD')}</span>
        <span className="dotSep">•</span>
        <span className="changePct">{formatPercent(pct)}</span>
      </div>

      <div className="mutedTiny">Shows change since 12:00 AM local time.</div>
    </div>
  )
}
