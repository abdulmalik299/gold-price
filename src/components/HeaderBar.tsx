import React from 'react'
import { hhmmss, nowLocalDateString } from '../lib/format'
import { LANGUAGE_OPTIONS, type Language, useI18n } from '../lib/i18n'

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
  const { lang, setLanguage, t } = useI18n()
  
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
            <div className="brandTitle">{t('brandTitle')}</div>
          </div>
          <div className="brandSub">{t('brandSub')}</div>
        </div>
      </div>

      <div className="headerRight">
        {canInstall && (
          <button type="button" className="btn btnGold installBtn" onClick={onInstall}>
            {t('installApp')}
            <span className="btnGlow" />
          </button>
        )}
        <div className="clockCard">
          <div className="clock">{clock}</div>
          <div className="clockSub">{nowLocalDateString()}</div>
          <div className="clockMeta">
            <div className="langSelectWrap">
              <span className="langLabel">{t('languageLabel')}</span>
              <select
                className="langSelect"
                value={lang}
                onChange={(event) => setLanguage(event.target.value as Language)}
                aria-label={t('languageLabel')}
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="updateCard">
          <div className="updateTitle">{t('localPriceUpdate')}</div>
          <div className="updateValue">
            {lastPriceUpdateAt ? new Date(lastPriceUpdateAt).toLocaleString() : '—'}
          </div>
          <button type="button" className="infoBtn updateTutorialBtn" onClick={onInfo} aria-label={t('openTutorialAria')}>
            <span className="infoIcon" aria-hidden="true">
              ⓘ
            </span>
            <span className="infoText">{t('tutorialVideo')}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
