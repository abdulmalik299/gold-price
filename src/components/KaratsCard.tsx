import React from 'react'
import Segmented from './Segmented'
import NumberInput from './NumberInput'
import { KaratKey, UnitKey, deltaAndPercent, priceForKarat } from '../lib/calc'
import { arrowForDelta, formatMoney, formatPercent, parseLooseNumber } from '../lib/format'
import { getJSON, setJSON } from '../lib/storage'

const KARATS: KaratKey[] = ['24k', '22k', '21k', '18k']

type RowState = {
  prevTotal: number | null
  prevAt: number | null
}

type Props = {
  ounceUsd: number | null
  onMainMarginSync?: (marginIqd: number) => void
  externalMarginIqd?: number
}

export default function KaratsCard({ ounceUsd, onMainMarginSync, externalMarginIqd }: Props) {
  const [usdToIqdText, setUsdToIqdText] = React.useState(() => getJSON('usdToIqdText', ''))
  const [unit, setUnit] = React.useState<UnitKey>(() => getJSON('unit', 'mithqal'))
  const [marginIqd, setMarginIqd] = React.useState<number>(() => getJSON('marginIqd', 0))

  // Persist
  React.useEffect(() => setJSON('usdToIqdText', usdToIqdText), [usdToIqdText])
  React.useEffect(() => setJSON('unit', unit), [unit])
  React.useEffect(() => setJSON('marginIqd', marginIqd), [marginIqd])

  // External margin sync (from solver)
  React.useEffect(() => {
    if (typeof externalMarginIqd === 'number' && Number.isFinite(externalMarginIqd)) {
      setMarginIqd(externalMarginIqd)
    }
  }, [externalMarginIqd])

  const usdToIqd = parseLooseNumber(usdToIqdText)
  const marginEnabled = !!usdToIqd && usdToIqd > 0

  const [rows, setRows] = React.useState<Record<KaratKey, RowState>>(() => getJSON('karatRows', {
    '24k': { prevTotal: null, prevAt: null },
    '22k': { prevTotal: null, prevAt: null },
    '21k': { prevTotal: null, prevAt: null },
    '18k': { prevTotal: null, prevAt: null },
  }))

  // Keep previous totals when ounce changes (so colors persist)
  React.useEffect(() => {
    if (ounceUsd == null) return
    setRows((prev) => {
      const next = { ...prev }
      for (const k of KARATS) {
        const curr = priceForKarat(ounceUsd, k, unit, usdToIqd, marginEnabled ? marginIqd : 0)
        // If we have no prev total, seed it. Otherwise, only update prev when total changes.
        const prevTotal = prev[k]?.prevTotal
        const prevAt = prev[k]?.prevAt
        if (prevTotal == null) {
          next[k] = { prevTotal: curr.total, prevAt: Date.now() }
        } else if (curr.total !== prevTotal) {
          // Move current total into prevTotal for delta calc next render
          next[k] = { prevTotal, prevAt }
          // We'll compute delta against prevTotal; persist occurs via localStorage.
        } else {
          next[k] = prev[k]
        }
      }
      setJSON('karatRows', next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ounceUsd, unit, usdToIqdText, marginIqd])

  // Slider UI
  function onSlider(v: number) {
    setMarginIqd(v)
    onMainMarginSync?.(v)
  }

  return (
    <div className="card karats">
      <div className="cardTop">
        <div className="cardTitle">Karats</div>
        <div className="inlineRight">
          <Segmented
            items={[
              { key: 'mithqal', label: 'Mithqal (5g)' },
              { key: 'gram', label: 'Gram' },
            ]}
            value={unit}
            onChange={(v) => setUnit(v)}
          />
        </div>
      </div>

      <div className="karatInputs">
        <NumberInput
          label="USD → IQD"
          value={usdToIqdText}
          onChange={setUsdToIqdText}
          placeholder="Leave empty for USD"
          hint="If filled, karats convert to IQD. Live ounce stays USD."
          suffix={marginEnabled ? 'IQD' : '$'}
        />
      </div>

      <div className="karatList">
        {KARATS.map((k) => {
          const p = ounceUsd == null ? null : priceForKarat(ounceUsd, k, unit, usdToIqd, marginEnabled ? marginIqd : 0)
          const currTotal = p?.total ?? 0
          const prevTotal = rows[k]?.prevTotal
          const { delta, pct } = deltaAndPercent(currTotal, prevTotal)
          const { arrow, tone } = arrowForDelta(delta)
          const cls = tone === 'up' ? 'chgUp' : tone === 'down' ? 'chgDown' : 'chgFlat'
          const money = p
            ? formatMoney(p.total, p.currency, p.currency === 'IQD' ? 0 : 2)
            : '—'
          const deltaMoney = p
            ? formatMoney(p.currency === 'IQD' ? delta : delta, p.currency, p.currency === 'IQD' ? 0 : 2)
            : '—'
          return (
            <div className="karatRow" key={k}>
              <div className="karatK">{k.toUpperCase()}</div>
              <div className="karatV">
                <div className="karatPrice">{money}</div>
                {p ? (
                  <div className={`changeRow mini ${cls}`}>
                    <span className="arrow">{arrow}</span>
                    <span>{deltaMoney}</span>
                    <span className="dotSep">•</span>
                    <span>{formatPercent(p.currency === 'IQD' ? pct : pct)}</span>
                  </div>
                ) : (
                  <div className="mutedTiny">waiting…</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="sliderWrap">
        <div className="sliderTop">
          <div className="sliderLabel">Margin / Tax (IQD)</div>
          <div className="sliderVal">{marginEnabled ? `${marginIqd.toLocaleString('en-US')} IQD` : 'Enable by entering USD→IQD'}</div>
        </div>

        <input
          type="range"
          min={0}
          max={70000}
          step={1000}
          value={marginIqd}
          disabled={!marginEnabled}
          onChange={(e) => onSlider(Number(e.target.value))}
          className="slider"
        />

        <div className="mutedTiny">Slider works for IQD-only karat prices. Ounce is unaffected.</div>
      </div>
    </div>
  )
}
