import React from 'react'
import HeaderBar from './components/HeaderBar'
import LiveOunceCard from './components/LiveOunceCard'
import KaratsCard from './components/KaratsCard'
import ExpectationCard from './components/ExpectationCard'
import MarginSolverCard from './components/MarginSolverCard'
import ConnectionStatus from './components/ConnectionStatus'
import Calculator from './components/Calculator'
import ChartCard from './components/ChartCard'

import { fetchLiveOuncePrice } from './lib/goldApi'
import { getJSON, setJSON } from './lib/storage'
import { useInterval } from './hooks/useInterval'

type LiveState = {
  ounceUsd: number | null
  prevOunceUsd: number | null
  lastPriceUpdateAt: number | null
}

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

export default function App() {
  // Load once, use the same initial value for state + ref
  const initialLiveRef = React.useRef<LiveState>(
    getJSON('liveState', { ounceUsd: null, prevOunceUsd: null, lastPriceUpdateAt: null })
  )
  const [live, setLive] = React.useState<LiveState>(initialLiveRef.current)
  const [mainMargin, setMainMargin] = React.useState<number>(getJSON('mainMargin', 0))

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
    <div className="app">
      <HeaderBar lastPriceUpdateAt={live.lastPriceUpdateAt} />

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
      </div>

      <footer className="foot">
        <div className="mutedTiny">
          Built for GitHub Pages. PWA-ready. Chart history comes from Supabase (Edge Function stores updates even when site is closed).
        </div>
      </footer>
    </div>
  )
}
