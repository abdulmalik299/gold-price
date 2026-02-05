import React from 'react'
import NumberInput from './NumberInput'
import { priceForKarat } from '../lib/calc'
import { formatMoney, parseLooseNumber } from '../lib/format'

export default function MarginSolverCard({
  onSolvedMargin,
}: {
  onSolvedMargin: (marginIqd: number) => void
}) {
  const [ounceText, setOunceText] = React.useState('')
  const [usdToIqdText, setUsdToIqdText] = React.useState('')
  const [local21Text, setLocal21Text] = React.useState('')

  const ounce = parseLooseNumber(ounceText)
  const usdToIqd = parseLooseNumber(usdToIqdText)
  const local21 = parseLooseNumber(local21Text)

  const can = ounce != null && usdToIqd != null && local21 != null && usdToIqd > 0

  let theoretical = null as null | number
  let margin = null as null | number
  if (can) {
    const p = priceForKarat(ounce!, '21k', 'mithqal', usdToIqd, 0)
    theoretical = p.total
    margin = Math.round((local21! - theoretical) / 1000) * 1000 // snap to 1000
  }

  return (
    <div className="card solver">
      <div className="cardTop">
        <div className="cardTitle">Tax / Margin Solve</div>
        <div className="pill subtle">Auto sync slider</div>
      </div>

      <div className="grid2">
        <NumberInput
          label="Local ounce price (USD)"
          value={ounceText}
          onChange={setOunceText}
          placeholder="e.g. 4900"
          hint="The gold ounce price you saw locally."
          suffix="$"
        />
        <NumberInput
          label="USD → IQD"
          value={usdToIqdText}
          onChange={setUsdToIqdText}
          placeholder="e.g. 1500"
          hint="Dollar price in IQD."
          suffix="IQD"
        />
      </div>

      <NumberInput
        label="Local 21K per mithqal"
        value={local21Text}
        onChange={setLocal21Text}
        placeholder="e.g. 450,000"
        hint="The 21k mithqal price you saw locally (IQD)."
        suffix="IQD"
      />

      <div className="solverOut">
        <div className="kv">
          <div className="k">Theoretical 21K mithqal</div>
          <div className="v">{theoretical == null ? '—' : formatMoney(theoretical, 'IQD', 0)}</div>
        </div>
        <div className="kv">
          <div className="k">Margin result</div>
          <div className="v">{margin == null ? '—' : formatMoney(margin, 'IQD', 0)}</div>
        </div>

        <button
          className="btn"
          type="button"
          disabled={margin == null || !Number.isFinite(margin)}
          onClick={() => onSolvedMargin(Math.max(0, margin ?? 0))}
        >
          <span className="btnGlow" />
          Apply margin to main slider
        </button>
      </div>

      <div className="mutedTiny">Calculates the margin for 21K mithqal based on your inputs and updates the main margin slider automatically..</div>
    </div>
  )
}
