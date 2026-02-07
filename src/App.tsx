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

type LiveState = {
  ounceUsd: number | null
  prevOunceUsd: number | null
  lastPriceUpdateAt: number | null
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

const VIDEO_SRC = `${import.meta.env.BASE_URL}media/tutorial.mp4`
const VIDEO_THUMB = `${import.meta.env.BASE_URL}media/thumbnail.png`

function formatAge(ms: number) {
  if (ms < 0) ms = 0
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)

  const ss = s % 60
  const mm = m % 60

  if (h > 0) return `${h}h ${mm}m ${ss}s`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
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
    <div className={`app ${showUsageNotice || showInfoNotice ? 'modalOpen' : ''}`}>
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
          Since last market move:{' '}
          {live.lastPriceUpdateAt ? formatAge(nowMs - live.lastPriceUpdateAt) : '—'}
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
              prevOunceUsd={live.prevOunceUsd}
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
              <div id="install-title" className="installModalTitle">Install on Android</div>
              <div className="installModalText">
                If the popup does not appear automatically, open your browser menu and tap
                <strong> Install app</strong> / <strong>Add to Home screen</strong>.
                This app is already configured as a PWA and works offline after install.
              </div>
              <button type="button" className="btn" onClick={() => setShowInstallHelp(false)}>Close</button>
            </div>
          </div>
        )}

        <footer className="foot">
          <div className="mutedTiny">
            Optimized for fast, reliable access. Price history is continuously saved and kept up to date automatically.
          </div>
        </footer>
      </div>

      {showUsageNotice && (
        <div className="noticeBackdrop" role="dialog" aria-modal="true" aria-labelledby="usage-notice-title">
          <div className="noticeModal">
            <div id="usage-notice-title" className="noticeTitle">
              User Notice and Usage Agreement — Please Read Carefully
            </div>
            <div className="noticeText">
              <p>
                Before using this tool, you are strongly advised to watch the official tutorial video. The video explains how the calculator works, how to enter values correctly, and how to interpret the results. Using the tool without understanding the instructions may lead to incorrect assumptions.
              </p>
              <p>
                This website is NOT affiliated with, approved by, or connected to any official gold authority, government body, or jewelers’ syndicate (including the Kurdistan Jewelers Syndicate / Gold Traders Association). The page does not use official local pricing feeds. Live gold ounce prices are obtained from global market data providers, and all other values shown by the tools are automated calculations.
              </p>
              <p>The platform includes tools for:</p>
              <ul>
                <li>Converting live ounce prices into local karat values based on weight (including 5-gram / mithqal style calculations)</li>
                <li>Estimating margins or local add-on charges typically applied by market regulators or local trade practice (user-entered or slider-based estimates, not official fees)</li>
                <li>Price expectation scenarios for educational planning purposes</li>
              </ul>
              <p>
                USD to IQD conversion inside the calculator is based on the value of 1 USD to IQD exchange rate — not bulk or 100-unit bank rates — unless explicitly stated otherwise.
              </p>
              <p>
                All calculations, margins, expectations, and conversion outputs are estimates for informational and educational use only. They are not official quotes, not trading offers, and not certified jeweler prices. Users must verify all numbers with a licensed jeweler or authorized gold trader before making any buying, selling, or financial decision.
              </p>
              <p>
                By continuing to use this page, you acknowledge and agree that you understand these limitations, accept full responsibility for your use of the results, and agree that the website owner is not liable for any loss, pricing difference, transaction outcome, or decision made based on the displayed data.
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
                confirm that I have watched the tutorial video, understand that all prices and calculations shown are informational estimates only, that this platform is not affiliated with any government or jewelers’ authority, and I accept full responsibility for how I use the results.
              </span>
            </label>
            <div className="noticeActions">
              <button type="button" className="btn btnGold" disabled={!usageConsentChecked} onClick={handleUsageConfirm}>
                Confirm
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
              User Notice — Please Read
            </div>
            <div className="noticeText">
              <p>
                Please watch the short tutorial video before using these tools. This platform provides live global gold ounce prices and automated calculators for karat conversion, local margin estimates, expectation scenarios, and USD-to-IQD conversion (based on 1 USD rate). It is not connected to any government authority or jewelers’ syndicate and does not provide official local jeweler prices. All values are informational estimates only and may differ from licensed jeweler quotes. Always verify prices and calculations with an authorized jeweler before making any buying or selling decision. By continuing to use this page, you accept responsibility for how you use the results.
              </p>
            </div>
            <NoticeVideo />
            <div className="noticeActions">
              <button type="button" className="btn" onClick={() => setShowInfoNotice(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function NoticeVideo() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null)
  const [ended, setEnded] = React.useState(false)
  const [hasStarted, setHasStarted] = React.useState(false)

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
          }}
        >
          <source src={VIDEO_SRC} type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        {!hasStarted && (
          <button
            type="button"
            className="noticeVideoOverlay"
            onClick={handlePlay}
            aria-label="Play tutorial video"
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
          Watch again
        </button>
      )}
    </div>
  )
}
