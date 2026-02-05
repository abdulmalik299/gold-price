import React from 'react'
import { hhmmss, nowLocalTimeString } from '../lib/format'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

type Platform = 'android' | 'ios' | 'windows' | 'mac' | 'other'
type InstallState = 'installed' | 'prompt' | 'ios' | 'manual'

function getPlatformFromUA(): Platform {
  const ua = navigator.userAgent.toLowerCase()
  if (/android/.test(ua)) return 'android'
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/windows/.test(ua)) return 'windows'
  if (/mac os x|macintosh/.test(ua)) return 'mac'
  return 'other'
}

function isIosSafari() {
  const ua = navigator.userAgent
  const isiOS = /iPad|iPhone|iPod/.test(ua)
  const isWebKit = /WebKit/.test(ua)
  const isCriOS = /CriOS/.test(ua)
  const isFxiOS = /FxiOS/.test(ua)
  return isiOS && isWebKit && !isCriOS && !isFxiOS
}

function isStandaloneApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function detectInstallState({
  installed,
  iosSafari,
  deferredPrompt,
}: {
  installed: boolean
  iosSafari: boolean
  deferredPrompt: BeforeInstallPromptEvent | null
}): InstallState {
  if (installed) return 'installed'
  if (deferredPrompt) return 'prompt'
  if (iosSafari) return 'ios'
  return 'manual'
}

export default function HeaderBar({
  lastPriceUpdateAt,
}: {
  lastPriceUpdateAt: number | null
}) {
  const [clock, setClock] = React.useState(hhmmss())
  const [deferredPrompt, setDeferredPrompt] = React.useState<BeforeInstallPromptEvent | null>(null)
  const [showIosHelp, setShowIosHelp] = React.useState(false)
  const [showInstallHelp, setShowInstallHelp] = React.useState(false)
  const [showOpenHelp, setShowOpenHelp] = React.useState(false)
  const [installed, setInstalled] = React.useState(false)

  const platform = React.useMemo(getPlatformFromUA, [])
  const iosSafari = React.useMemo(isIosSafari, [])
  
  React.useEffect(() => {
    const id = window.setInterval(() => setClock(hhmmss()), 1000)
    return () => window.clearInterval(id)
  }, [])

  React.useEffect(() => {
    setInstalled(isStandaloneApp() || localStorage.getItem('pwa-installed') === '1')

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }

    const onInstalled = () => {
      localStorage.setItem('pwa-installed', '1')
      setInstalled(true)
      setDeferredPrompt(null)
      setShowIosHelp(false)
      setShowInstallHelp(false)
    }

    const standaloneMedia = window.matchMedia('(display-mode: standalone)')
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        localStorage.setItem('pwa-installed', '1')
      }
      setInstalled(event.matches)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
    standaloneMedia.addEventListener('change', onDisplayModeChange)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      standaloneMedia.removeEventListener('change', onDisplayModeChange)
    }
  }, [])

  const runningStandalone = isStandaloneApp()
  const installState = detectInstallState({ installed, iosSafari, deferredPrompt })

  const shouldShowInstallButton = !runningStandalone

  const installLabel = installState === 'installed' ? 'Open App' : 'Install App'

  const onInstallClick = async () => {
    if (installState === 'installed') {
      setShowOpenHelp(true)
      return
    }

    if (installState === 'prompt' && deferredPrompt) {
      await deferredPrompt.prompt()
      const choice = await deferredPrompt.userChoice
      if (choice.outcome === 'accepted') {
        localStorage.setItem('pwa-installed', '1')
        setInstalled(true)
      }
      setDeferredPrompt(null)
      return
    }

    if (installState === 'ios') {
      setShowIosHelp(true)
      return
    }

    setShowInstallHelp(true)
  }

  return (
    <>
      <div className="header">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} className="brandIcon" alt="Au" />
          <div>
            <div className="brandTitle">Live Gold Monitor</div>
            <div className="brandSub">Live Gold Monitor & Tools</div>
          </div>
        </div>

        <div className="headerRight">
          <div className="clockCard">
            <div className="clock">{clock}</div>
            <div className="clockSub">{nowLocalTimeString()}</div>
          </div>

          {shouldShowInstallButton ? (
            <button
              type="button"
              className="btn btnGold installBtn"
              onClick={onInstallClick}
              aria-label={`Install app for ${platform}`}
            >
              {installLabel}
            </button>
          ) : null}

          <div className="updateCard">
            <div className="updateTitle">Last price update</div>
            <div className="updateValue">
              {lastPriceUpdateAt ? new Date(lastPriceUpdateAt).toLocaleString() : '—'}
            </div>
          </div>
        </div>
      </div>

      {showIosHelp ? (
        <div className="installModalBackdrop" role="dialog" aria-modal="true" aria-label="Install on iOS">
          <div className="installModal">
            <div className="installModalTitle">Install on iPhone / iPad</div>
            <div className="installModalText">
              In Safari, tap <b>Share</b>, choose <b>Add to Home Screen</b>, then tap <b>Add</b>.
            </div>
            <button type="button" className="btn btnGold" onClick={() => setShowIosHelp(false)}>
              Got it
            </button>
          </div>
        </div>
      ) : null}
  
      {showInstallHelp ? (
        <div className="installModalBackdrop" role="dialog" aria-modal="true" aria-label="Install help">
          <div className="installModal">
            <div className="installModalTitle">Install App (Android / Windows)</div>
            <div className="installModalText">
              If the install popup is unavailable, open your browser menu and choose
              <b> Install app</b> / <b>Add to Home Screen</b>. On Android this installs a PWA app
              (WebAPK when supported), and on Windows it installs from Edge/Chrome to your Start menu.
            </div>
            <button type="button" className="btn btnGold" onClick={() => setShowInstallHelp(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}

      {showOpenHelp ? (
        <div className="installModalBackdrop" role="dialog" aria-modal="true" aria-label="Open app">
          <div className="installModal">
            <div className="installModalTitle">App already installed</div>
            <div className="installModalText">
              Open the app from your Home Screen (iOS/Android) or Start Menu (Windows).
            </div>
            <button type="button" className="btn btnGold" onClick={() => setShowOpenHelp(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
