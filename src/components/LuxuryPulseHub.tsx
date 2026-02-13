import React from 'react'
import { useI18n } from '../lib/i18n'

type LuxuryPulseHubProps = {
  ounceUsd: number | null
  prevOunceUsd: number | null
  lastPriceUpdateAt: number | null
}

function formatDelta(current: number | null, previous: number | null) {
  if (current == null || previous == null || previous === 0) {
    return { value: '—', positive: true, percentage: 0 }
  }

  const delta = current - previous
  const percentage = (delta / previous) * 100
  return {
    value: `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} USD`,
    positive: delta >= 0,
    percentage,
  }
}

export default function LuxuryPulseHub({ ounceUsd, prevOunceUsd, lastPriceUpdateAt }: LuxuryPulseHubProps) {
  const { t } = useI18n()
  const delta = formatDelta(ounceUsd, prevOunceUsd)
  const confidence = Math.min(99, Math.max(36, 64 + Math.round(Math.abs(delta.percentage) * 11)))

  const marketMode =
    delta.percentage > 0.2 ? t('marketModeAccumulation') : delta.percentage < -0.2 ? t('marketModeRepricing') : t('marketModeBalance')

  const updatedAgo = lastPriceUpdateAt ? Math.max(1, Math.round((Date.now() - lastPriceUpdateAt) / 1000)) : null

  const strategicTiles = [
    { title: t('featureAiSignalEngine'), detail: t('featureAiSignalEngineDetail') },
    { title: t('featureSmartAlerts'), detail: t('featureSmartAlertsDetail') },
    { title: t('featureMacroOverlay'), detail: t('featureMacroOverlayDetail') },
    { title: t('featureVaultMode'), detail: t('featureVaultModeDetail') },
  ]

  return (
    <section className="luxuryHub card">
      <div className="luxuryHubHeader">
        <div>
          <p className="eyebrow">{t('nextGenDesk')}</p>
          <h2>{t('executivePulseTitle')}</h2>
        </div>
        <div className="marketModeBadge">{marketMode}</div>
      </div>

      <div className="signalBand">
        <div>
          <p className="mutedTiny">{t('realTimeDelta')}</p>
          <strong className={delta.positive ? 'upText' : 'downText'}>{delta.value}</strong>
        </div>
        <div>
          <p className="mutedTiny">{t('liquidityConfidence')}</p>
          <strong>{confidence}%</strong>
        </div>
        <div>
          <p className="mutedTiny">{t('lastSyncSeconds')}</p>
          <strong>{updatedAgo == null ? '—' : `${updatedAgo}s`}</strong>
        </div>
      </div>

      <div className="strategicGrid">
        {strategicTiles.map((tile) => (
          <article key={tile.title} className="strategicTile">
            <h3>{tile.title}</h3>
            <p>{tile.detail}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
