import React from 'react'
import { sampleNetwork, type NetStatus } from '../lib/net'
import { formatWithCommas } from '../lib/format'
import { useInterval } from '../hooks/useInterval'

function labelForKbps(kbps: number | null) {
  if (kbps == null) return '—'
  if (kbps < 300) return 'Very Low'
  if (kbps < 1500) return 'Low'
  if (kbps < 8000) return 'Good'
  return 'Strong'
}

export default function ConnectionStatus() {
  const [s, setS] = React.useState<NetStatus>({ online: navigator.onLine, rttMs: null, downKbps: null, at: Date.now() })

  const refresh = React.useCallback(async () => {
    const next = await sampleNetwork()
    setS(next)
  }, [])

  React.useEffect(() => {
    const on = () => refresh()
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    refresh()
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [refresh])

  useInterval(() => { refresh() }, 15_000)

  const tone = s.online ? 'online' : 'offline'
  const ms = s.rttMs == null ? '—' : `${Math.round(s.rttMs)} ms`
  const kbps = s.downKbps == null ? '—' : `${formatWithCommas(s.downKbps, 0)} kbps`

  return (
    <div className="card conn">
      <div className="cardTop">
        <div className="cardTitle">Connection</div>
        <div className={`pill ${tone}`}>
          <span className="dot" />
          {s.online ? 'Online' : 'Offline'}
        </div>
      </div>

      <div className="connGrid">
        <div className="kv">
          <div className="k">Latency</div>
          <div className="v">{ms}</div>
        </div>
        <div className="kv">
          <div className="k">Download</div>
          <div className="v">{kbps}</div>
        </div>
        <div className="kv">
          <div className="k">Quality</div>
          <div className="v">{labelForKbps(s.downKbps)}</div>
        </div>
        <button className="btn" type="button" onClick={refresh}>
          <span className="btnGlow" />
          Recheck
        </button>
      </div>

      <div className="mutedTiny">Note: If your internet connection is slow or offline, price updates may be delayed. Live prices are fetched automatically from our data provider..</div>
    </div>
  )
}
