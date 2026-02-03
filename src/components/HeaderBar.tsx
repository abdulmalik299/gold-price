import React from 'react'
import { hhmmss, nowLocalTimeString } from '../lib/format'

export default function HeaderBar({
  lastPriceUpdateAt,
}: {
  lastPriceUpdateAt: number | null
}) {
  const [clock, setClock] = React.useState(hhmmss())

  React.useEffect(() => {
    const id = window.setInterval(() => setClock(hhmmss()), 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="header">
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} className="brandIcon" alt="Au" />
        <div>
          <div className="brandTitle">GoldDash</div>
          <div className="brandSub">Live luxury gold dashboard</div>
        </div>
      </div>

      <div className="headerRight">
        <div className="clockCard">
          <div className="clock">{clock}</div>
          <div className="clockSub">{nowLocalTimeString()}</div>
        </div>

        <div className="updateCard">
          <div className="updateTitle">Last price update</div>
          <div className="updateValue">
            {lastPriceUpdateAt ? new Date(lastPriceUpdateAt).toLocaleString() : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
