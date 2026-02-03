import React from 'react'
import Segmented from './Segmented'
import NumberInput from './NumberInput'
import { KaratKey, UnitKey, deltaAndPercent, priceForKarat } from '../lib/calc'
import { arrowForDelta, formatMoney, formatPercent, parseLooseNumber } from '../lib/format'
import { getJSON, setJSON } from '../lib/storage'

const KARATS: KaratKey[] = ['24k', '22k', '21k', '18k']

type Props = {
  ounceUsd: number | null
  prevOunceUsd: number | null
  onMainMarginSync?: (marginIqd: number) => void
  externalMarginIqd?: number
}

export default function KaratsCard({ ounceUsd, prevOunceUsd, onMainMarginSync, externalMarginIqd }: Props) {
  const [usdToIqdText, setUsdToIqdText] = React.useState(() => getJSON('usdToIqdText', ''))
  const [unit, setUnit] = React.useState<UnitKey>(() => getJSON('unit', 'mithqal'))
  const [marginIqd, setMarginIqd] = React.useState<number>(() => getJSON('marginIqd', 0))

  // Persist inputs
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
  const effectiveMargin = marginEnabled ? marginIqd : 0

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
          // Current computed price for this karat (depends on unit/usdToIqd/margin)
          const curr =
            ounceUsd == null ? null : priceForKarat(ounceUsd, k, unit, usdToIqd, effectiveMargin)

          // Previous computed price for this karat, based ONLY on prevOunceUsd market price.
          // ✅ This prevents USD→IQD edits and slider changes from faking “market moves”.
          const prev =
            prevOunceUsd == null
              ? null
              : priceForKarat(prevOunceUsd, k, unit, usdToIqd, effectiveMargin)

          const currency = curr?.currency ?? 'USD'
          const decimals = currency === 'IQD' ? 0 : 2

          const currTotal = curr?.total ?? 0
          const prevTotal = prev?.total ?? null

          const { delta, pct } = deltaAndPercent(currTotal, prevTotal)
          const { arrow, tone } = arrowForDelta(delta)
          const cls = tone === 'up' ? 'chgUp' : tone === 'down' ? 'chgDown' : 'chgFlat'

          const money = curr ? formatMoney(curr.total, currency, decimals) : '—'
          const deltaMoney = curr ? formatMoney(delta, currency, decimals) : '—'

          return (
            <div className="karatRow" key={k}>
              <div className="karatK">{k.toUpperCase()}</div>
              <div className="karatV">
                <div className="karatPrice">{money}</div>

                {curr ? (
                  <div className={`changeRow mini ${cls}`}>
                    <span className="arrow">{arrow}</span>
                    <span>{deltaMoney}</span>
                    <span className="dotSep">•</span>
                    <span>{formatPercent(pct)}</span>
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
          <div className="sliderVal">
            {marginEnabled ? `${marginIqd.toLocaleString('en-US')} IQD` : 'Enable by entering USD→IQD'}
          </div>
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
