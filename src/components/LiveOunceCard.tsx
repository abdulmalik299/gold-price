import React from 'react'
import { arrowForDelta, formatMoney, formatPercent } from '../lib/format'
import { deltaAndPercent } from '../lib/calc'

export default function LiveOunceCard({
  ounceUsd,
  prevOunceUsd,
}: {
  ounceUsd: number | null
  prevOunceUsd: number | null
}) {
  const now = ounceUsd ?? 0
  const prev = prevOunceUsd
  const { delta, pct } = deltaAndPercent(now, prev)
  const { arrow, tone } = arrowForDelta(delta)
  const cls = tone === 'up' ? 'chgUp' : tone === 'down' ? 'chgDown' : 'chgFlat'

  return (
    <div className="card liveOunce">
      <div className="cardTop">
        <div className="cardTitle">Live Gold (XAU)</div>
        <div className="pill subtle">per ounce</div>
      </div>

      <div className="bigNumber">{ounceUsd == null ? '—' : formatMoney(ounceUsd, 'USD')}</div>

      <div className={`changeRow ${cls}`}>
        <span className="arrow">{arrow}</span>
        <span className="changeAmt">{formatMoney(delta, 'USD')}</span>
        <span className="dotSep">•</span>
        <span className="changePct">{formatPercent(pct)}</span>
      </div>

      <div className="mutedTiny">Gain/Loss stays colored until the next price change.</div>
    </div>
  )
}
