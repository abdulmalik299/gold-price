import React from 'react'
import NumberInput from './NumberInput'
import Segmented from './Segmented'
import type { KaratKey, UnitKey } from '../lib/calc'
import { priceForKarat } from '../lib/calc'
import { formatMoney, parseLooseNumber } from '../lib/format'
import { getJSON, setJSON } from '../lib/storage'

export default function ExpectationCard() {
  const [ounceText, setOunceText] = React.useState(() => getJSON('expOunceText', ''))
  const [usdToIqdText, setUsdToIqdText] = React.useState(() => getJSON('expUsdToIqdText', ''))
  const [karat, setKarat] = React.useState<KaratKey>(() => getJSON('expKarat', '21k'))
  const [unit, setUnit] = React.useState<UnitKey>(() => getJSON('expUnit', 'mithqal'))
  const [marginIqd, setMarginIqd] = React.useState<number>(() => getJSON('expMarginIqd', 0))

  React.useEffect(() => setJSON('expOunceText', ounceText), [ounceText])
  React.useEffect(() => setJSON('expUsdToIqdText', usdToIqdText), [usdToIqdText])
  React.useEffect(() => setJSON('expKarat', karat), [karat])
  React.useEffect(() => setJSON('expUnit', unit), [unit])
  React.useEffect(() => setJSON('expMarginIqd', marginIqd), [marginIqd])

  const ounce = parseLooseNumber(ounceText)
  const usdToIqd = parseLooseNumber(usdToIqdText)
  const marginEnabled = !!usdToIqd && usdToIqd > 0

  const price = ounce == null ? null : priceForKarat(ounce, karat, unit, usdToIqd, marginEnabled ? marginIqd : 0)

  return (
    <div className="card exp">
      <div className="cardTop">
        <div className="cardTitle">Expectation</div>
        <div className="pill subtle">What-if calculator</div>
      </div>

      <div className="grid2">
        <NumberInput
          label="Expected ounce price"
          value={ounceText}
          onChange={setOunceText}
          placeholder="e.g. 4900.50"
          hint="Write your expected XAU (USD per ounce)."
          suffix="$"
        />
        <NumberInput
          label="USD → IQD"
          value={usdToIqdText}
          onChange={setUsdToIqdText}
          placeholder="e.g. 1500"
          hint="If filled, result is IQD."
          suffix="IQD"
        />
      </div>

      <div className="expControls">
        <Segmented
          items={[
            { key: '21k', label: '21K' },
            { key: '22k', label: '22K' },
            { key: '18k', label: '18K' },
            { key: '24k', label: '24K' },
          ]}
          value={karat}
          onChange={(v) => setKarat(v as KaratKey)}
        />
        <Segmented
          items={[
            { key: 'mithqal', label: 'Mithqal (5g)' },
            { key: 'gram', label: 'Gram' },
          ]}
          value={unit}
          onChange={(v) => setUnit(v as UnitKey)}
        />
      </div>

      <div className="expResult">
        <div className="expBig">
          {price
            ? formatMoney(price.total, price.currency, price.currency === 'IQD' ? 0 : 2)
            : '—'}
        </div>
        <div className="mutedTiny">
          {marginEnabled ? `Includes margin: ${marginIqd.toLocaleString('en-US')} IQD` : 'Add USD→IQD to enable IQD margin slider.'}
        </div>
      </div>

      <div className="sliderWrap">
        <div className="sliderTop">
          <div className="sliderLabel">Expectation margin (IQD)</div>
          <div className="sliderVal">{marginEnabled ? `${marginIqd.toLocaleString('en-US')} IQD` : 'Enable by entering USD→IQD'}</div>
        </div>
        <input
          type="range"
          min={0}
          max={70000}
          step={1000}
          value={marginIqd}
          disabled={!marginEnabled}
          onChange={(e) => setMarginIqd(Number(e.target.value))}
          className="slider"
        />
      </div>
    </div>
  )
}
