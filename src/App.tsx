import React from 'react'
import HeaderBar from './components/HeaderBar'
import LiveOunceCard from './components/LiveOunceCard'
import KaratsCard from './components/KaratsCard'
import ExpectationCard from './components/ExpectationCard'
import MarginSolverCard from './components/MarginSolverCard'
import ConnectionStatus from './components/ConnectionStatus'
import Calculator from './components/Calculator'
import ChartCard from './components/ChartCard'
import FeedbackCard from './components/FeedbackCard'

import { fetchLiveOuncePrice } from './lib/goldApi'
import { getJSON, setJSON } from './lib/storage'
import { useInterval } from './hooks/useInterval'
import { createTranslator, getDirection, I18nContext, normalizeLanguage, type Language, useI18n } from './lib/i18n'

type LiveState = {
  ounceUsd: number | null
  prevOunceUsd: number | null
  lastPriceUpdateAt: number | null
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const VIDEO_SRC = 'https://pub-8f48e2dbfd7f4f0080da3b71b362a9d4.r2.dev'
const VIDEO_CACHE_NAME = 'tutorial-video-cache'
const VIDEO_THUMB = `${import.meta.env.BASE_URL}media/thumbnail.png`

function formatAge(ms: number, labels: { h: string; m: string; s: string }) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)

  const ss = s % 60
  const mm = m % 60

  if (h > 0) return `${h}${labels.h} ${mm}${labels.m} ${ss}${labels.s}`
  if (m > 0) return `${m}${labels.m} ${ss}${labels.s}`
  return `${ss}${labels.s}`
}

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

export default function App() {
  // Load once, use the same initial value for state + ref
  const initialLiveRef = React.useRef<LiveState>(
    getJSON('liveState', { ounceUsd: null, prevOunceUsd: null, lastPriceUpdateAt: null })
  )
  const [live, setLive] = React.useState<LiveState>(initialLiveRef.current)
  const [mainMargin, setMainMargin] = React.useState<number>(getJSON('mainMargin', 0))
  const [deferredInstallPrompt, setDeferredInstallPrompt] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [showInstallHelp, setShowInstallHelp] = React.useState(false)
  const [isInstalled, setIsInstalled] = React.useState(isStandaloneMode)
  const [showUsageNotice, setShowUsageNotice] = React.useState(() => !getJSON('usageNoticeAccepted', false))
  const [showInfoNotice, setShowInfoNotice] = React.useState(false)
  const [usageConsentChecked, setUsageConsentChecked] = React.useState(false)
  const [language, setLanguage] = React.useState<Language>(() => normalizeLanguage(getJSON('language', 'ku')))
  const dir = getDirection(language)
  const t = React.useMemo(() => createTranslator(language), [language])
  
  React.useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const onAppInstalled = () => {
      setDeferredInstallPrompt(null)
      setIsInstalled(true)
      setShowInstallHelp(false)
    }

    const onDisplayModeChange = () => {
      setIsInstalled(isStandaloneMode())
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    window.matchMedia('(display-mode: standalone)').addEventListener('change', onDisplayModeChange)
    
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      window.matchMedia('(display-mode: standalone)').removeEventListener('change', onDisplayModeChange)
    }
  }, [])

  const handleInstall = React.useCallback(async () => {
    if (deferredInstallPrompt) {
      await deferredInstallPrompt.prompt()
      const { outcome } = await deferredInstallPrompt.userChoice
      setDeferredInstallPrompt(null)
      if (outcome === 'accepted') {
        setShowInstallHelp(false)
      }
      return
    }

    setShowInstallHelp(true)
  }, [deferredInstallPrompt])

  const handleUsageConfirm = React.useCallback(() => {
    setJSON('usageNoticeAccepted', true)
    setShowUsageNotice(false)
    setUsageConsentChecked(false)
  }, [])
  
  // Pulse counter: increments ONLY when price truly changes (for animation/remount)
  const [pricePulse, setPricePulse] = React.useState(0)

  // A ref to detect “real change” safely (not affected by stale state closures)
  const lastOunceRef = React.useRef<number | null>(initialLiveRef.current.ounceUsd)

  // “now” ticker for the label (no API calls, just UI time)
  const [nowMs, setNowMs] = React.useState(() => Date.now())
  React.useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Persist across reloads
  React.useEffect(() => setJSON('liveState', live), [live])
  React.useEffect(() => setJSON('mainMargin', mainMargin), [mainMargin])
  React.useEffect(() => setJSON('language', language), [language])

  React.useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = dir
  }, [dir, language])

  const pull = React.useCallback(async () => {
    try {
      const p = await fetchLiveOuncePrice()

      // Decide “changed” using ref (reliable)
      const changed = lastOunceRef.current == null ? true : p !== lastOunceRef.current

      if (changed) {
        lastOunceRef.current = p
        setPricePulse((x) => x + 1) // animate ONLY on real change
      }

      setLive((s) => ({
        ounceUsd: p,
        // only update prev when the market price actually changes
        prevOunceUsd: changed ? s.ounceUsd : s.prevOunceUsd,
        lastPriceUpdateAt: changed ? Date.now() : s.lastPriceUpdateAt,
      }))
    } catch {
      // keep existing
    }
  }, [])

  React.useEffect(() => {
    pull()
  }, [pull])

  // Poll every 10 seconds (you can change)
  useInterval(() => {
    pull()
  }, 10_000)

  return (
    <I18nContext.Provider value={{ lang: language, dir, t, setLanguage }}>
      <div className={`app ${dir === 'rtl' ? 'rtl' : ''} ${showUsageNotice || showInfoNotice ? 'modalOpen' : ''}`}>
        <div className="appContent" aria-hidden={showUsageNotice || showInfoNotice}>
          <HeaderBar
            lastPriceUpdateAt={live.lastPriceUpdateAt}
            canInstall={!isInstalled}
            onInstall={() => {
              void handleInstall()
            }}
            onInfo={() => setShowInfoNotice(true)}
          />

          {/* Since last market move label */}
          <div className="mutedTiny" style={{ padding: '0 18px', marginTop: 6 }}>
            {t('sinceLastMarketMove')}{' '}
            {live.lastPriceUpdateAt
              ? formatAge(nowMs - live.lastPriceUpdateAt, {
                h: t('timeHourShort'),
                m: t('timeMinuteShort'),
                s: t('timeSecondShort'),
              })
              : '—'}
          </div>

          <div className="layout">
            <div className="leftCol">
              <div className="gridTop">
                {/* key forces remount ONLY when price truly changes (pricePulse increments) */}
                <LiveOunceCard key={pricePulse} ounceUsd={live.ounceUsd} />
                <ConnectionStatus />
              </div>

              <ChartCard liveOunceUsd={live.ounceUsd} />
            </div>

            <div className="rightCol">
              <KaratsCard
                ounceUsd={live.ounceUsd}
                externalMarginIqd={mainMargin}
                onMainMarginSync={setMainMargin}
              />
              <ExpectationCard />
              <MarginSolverCard onSolvedMargin={(m) => setMainMargin(m)} />
              <Calculator />
            </div>
            <div className="feedbackSlot">
              <FeedbackCard />
            </div>
          </div>

          {showInstallHelp && (
            <div className="installModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="install-title">
              <div className="installModal">
                <div id="install-title" className="installModalTitle">{t('installModalTitle')}</div>
                <div className="installModalText">
                  {t('installModalText')}
                </div>
                <button type="button" className="btn" onClick={() => setShowInstallHelp(false)}>{t('close')}</button>
              </div>
            </div>
          )}

          <footer className="foot">
            <div className="mutedTiny">
              {t('footerNote')}
            </div>
          </footer>
        </div>

        {showUsageNotice && (
          <div className="noticeBackdrop" role="dialog" aria-modal="true" aria-labelledby="usage-notice-title">
            <div className="noticeModal">
              <div id="usage-notice-title" className="noticeTitle">
                {t('usageNoticeTitle')}
              </div>
              <div className="noticeText">
                <p>
                  {t('usageNoticeP1')}
                </p>
                <p>
                  {t('usageNoticeP2')}
                </p>
                <p>{t('usageNoticeP3Intro')}</p>
                <ul>
                  <li>{t('usageNoticeList1')}</li>
                  <li>{t('usageNoticeList2')}</li>
                  <li>{t('usageNoticeList3')}</li>
                </ul>
                <p>
                  {t('usageNoticeP4')}
                </p>
                <p>
                  {t('usageNoticeP5')}
                </p>
                <p>
                  {t('usageNoticeP6')}
                </p>
              </div>
              <NoticeVideo />
              <label className="noticeCheckbox">
                <input
                  type="checkbox"
                  checked={usageConsentChecked}
                  onChange={(event) => setUsageConsentChecked(event.target.checked)}
                />
                <span>
                  {t('usageNoticeCheckbox')}
                </span>
              </label>
              <div className="noticeActions">
                <button type="button" className="btn btnGold" disabled={!usageConsentChecked} onClick={handleUsageConfirm}>
                  {t('confirm')}
                  <span className="btnGlow" />
                </button>
              </div>
            </div>
          </div>
        )}

        {showInfoNotice && (
          <div className="noticeBackdrop" role="dialog" aria-modal="true" aria-labelledby="info-notice-title">
            <div className="noticeModal">
              <div id="info-notice-title" className="noticeTitle">
                {t('infoNoticeTitle')}
              </div>
              <div className="noticeText">
                <p>
                  {t('infoNoticeText')}
                </p>
              </div>
              <NoticeVideo />
              <div className="noticeActions">
                <button type="button" className="btn" onClick={() => setShowInfoNotice(false)}>{t('close')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </I18nContext.Provider>
  )
}

function NoticeVideo() {
  const { t } = useI18n()
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const hasCachedRef = React.useRef(false)
  const [ended, setEnded] = React.useState(false)
  const [hasStarted, setHasStarted] = React.useState(false)

  const ensureVideoCached = React.useCallback(async () => {
    if (hasCachedRef.current || !('caches' in window)) return
    hasCachedRef.current = true
    const cache = await caches.open(VIDEO_CACHE_NAME)
    const existing = await cache.match(VIDEO_SRC)
    if (existing) return
    const response = await fetch(VIDEO_SRC, { cache: 'no-store' })
    if (response.ok) {
      await cache.put(VIDEO_SRC, response)
    }
  }, [])

  const handleReplay = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    void videoRef.current.play()
    setHasStarted(true)
    setEnded(false)
  }

  const handlePlay = () => {
    if (!videoRef.current) return
    setHasStarted(true)
    void ensureVideoCached()
    void videoRef.current.play()
  }

  return (
    <div className="noticeVideo">
      <div className="noticeVideoFrame">
        <video
          ref={videoRef}
          className="noticeVideoPlayer"
          controls
          preload="metadata"
          poster={VIDEO_THUMB}
          onEnded={() => setEnded(true)}
          onPlay={() => {
            setEnded(false)
            setHasStarted(true)
            void ensureVideoCached()
          }}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
          {t('videoUnsupported')}
        </video>
        {!hasStarted && (
          <button
            type="button"
            className="noticeVideoOverlay"
            onClick={handlePlay}
            aria-label={t('playTutorialAria')}
            style={{ backgroundImage: `url(${VIDEO_THUMB})` }}
          >
            <span className="noticePlayButton" aria-hidden="true">
              <svg viewBox="0 0 64 64" role="presentation" focusable="false">
                <path d="M24 18.5v27l23-13.5-23-13.5z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      {ended && (
        <button type="button" className="btn noticeReplay" onClick={handleReplay}>
          {t('watchAgain')}
        </button>
      )}
    </div>
  )
}
