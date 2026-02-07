import React from 'react'
import { hhmmss, nowLocalTimeString } from '../lib/format'

export default function HeaderBar({
  lastPriceUpdateAt,
  canInstall,
  onInstall,
  onInfo,
}: {
  lastPriceUpdateAt: number | null
  canInstall: boolean
  onInstall: () => void
  onInfo: () => void
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
          <div className="brandTitleRow">
            <div className="brandTitle">Live Gold Monitor</div>
            <div className="infoCluster">
              <button type="button" className="infoBtn" onClick={onInfo} aria-label="Open tutorial video notice">
                <span className="infoIcon" aria-hidden="true">
                  ⓘ
                </span>
                <span className="infoText">Tutorial Video</span>
              </button>
              {canInstall && (
                <button type="button" className="btn btnGold installBtn" onClick={onInstall}>
                  Install app
                  <span className="btnGlow" />
                </button>
              )}
            </div>
          </div>
          <div className="brandSub">Live Gold Monitor & Tools</div>
        </div>
      </div>

      <div className="headerRight">
        <div className="clockCard">
          <div className="clock">{clock}</div>
          <div className="clockSub">{nowLocalTimeString()}</div>
        </div>

        <div className="updateCard">
          <div className="updateTitle">Local price update</div>
          <div className="updateValue">
            {lastPriceUpdateAt ? new Date(lastPriceUpdateAt).toLocaleString() : '—'}
          </div>
        </div>
      </div>
    </div>
  )
}
