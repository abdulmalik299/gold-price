import React from 'react'
import { sampleNetwork, type NetStatus } from '../lib/net'
import { formatWithCommas } from '../lib/format'
import { useInterval } from '../hooks/useInterval'
import { useI18n, type Translate } from '../lib/i18n'

function labelForKBps(kbps: number | null, t: Translate) {
  if (kbps == null) return '—'
  if (kbps < 300) return t('qualityVeryLow')
  if (kbps < 1500) return t('qualityLow')
  if (kbps < 8000) return t('qualityGood')
  return t('qualityStrong')
}

function formatDownloadSpeed(kbPerSecond: number | null) {
  if (kbPerSecond == null) return '—'
  if (kbPerSecond >= 1024) {
    return `${formatWithCommas(kbPerSecond / 1024, 2)} MB/s`
  }
  return `${formatWithCommas(kbPerSecond, 0)} KB/s`
}

export default function ConnectionStatus() {
  const { t } = useI18n()
  const [s, setS] = React.useState<NetStatus>({ online: navigator.onLine, rttMs: null, downKBps: null, at: Date.now() })

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
  const downloadSpeed = formatDownloadSpeed(s.downKBps)

  return (
    <div className="card conn">
      <div className="cardTop">
        <div className="cardTitle">{t('connectionTitle')}</div>
        <div className={`pill ${tone}`}>
          <span className="dot" />
          {s.online ? t('online') : t('offline')}
        </div>
      </div>

      <div className="connGrid">
        <div className="kv">
          <div className="k">{t('latency')}</div>
          <div className="v">{ms}</div>
        </div>
        <div className="kv">
          <div className="k">{t('download')}</div>
          <div className="v">{downloadSpeed}</div>
        </div>
        <div className="kv">
          <div className="k">{t('quality')}</div>
          <div className="v">{labelForKBps(s.downKBps, t)}</div>
        </div>
        <button className="btn" type="button" onClick={refresh}>
          <span className="btnGlow" />
          {t('recheck')}
        </button>
      </div>

      <div className="mutedTiny">{t('connectionNote')}</div>
    </div>
  )
}
