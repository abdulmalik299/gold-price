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

export default function App() {
  const [live, setLive] = React.useState<LiveState>(() =>
    getJSON('liveState', { ounceUsd: null, prevOunceUsd: null, lastPriceUpdateAt: null })
  )
  const [mainMargin, setMainMargin] = React.useState<number>(getJSON('mainMargin', 0))

  React.useEffect(() => setJSON('liveState', live), [live])
  React.useEffect(() => setJSON('mainMargin', mainMargin), [mainMargin])

  const pull = React.useCallback(async () => {
    try {
      const p = await fetchLiveOuncePrice()
      setLive((s) => {
         const changed = s.ounceUsd == null ? true : p !== s.ounceUsd

         return {
           ounceUsd: p,
         // ⬇️ only update previous price WHEN the price actually changes
           prevOunceUsd: changed ? s.ounceUsd : s.prevOunceUsd,
           lastPriceUpdateAt: changed ? Date.now() : s.lastPriceUpdateAt,
         }
       })

    } catch {
      // keep existing
    }
  }, [])

  React.useEffect(() => {
    pull()
  }, [pull])

  // Poll every 10 seconds (you can change)
  useInterval(() => { pull() }, 10_000)

  return (
    <div className="app">
      <div className="bgGlow" />
      <HeaderBar lastPriceUpdateAt={live.lastPriceUpdateAt} />

      <div className="layout">
        <div className="leftCol">
          <div className="gridTop">
            <LiveOunceCard ounceUsd={live.ounceUsd} prevOunceUsd={live.prevOunceUsd} />
            <ConnectionStatus />
          </div>

          <ChartCard liveOunceUsd={live.ounceUsd} />
        </div>

        <div className="rightCol">
          <KaratsCard ounceUsd={live.ounceUsd} externalMarginIqd={mainMargin} onMainMarginSync={setMainMargin} />
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
