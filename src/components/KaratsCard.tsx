import React from 'react'
import Segmented from './Segmented'
import NumberInput from './NumberInput'
import { KaratKey, UnitKey, deltaAndPercent, priceForKarat } from '../lib/calc'
import { arrowForDelta, formatMoney, formatPercent, parseLooseNumber } from '../lib/format'
import { getJSON, setJSON } from '../lib/storage'

const KARATS: KaratKey[] = ['24k', '22k', '21k', '18k']

type KaratRowState = {
  // last computed total (used only to detect changes)
  lastTotal: number | null
  // previous total (used for delta/pct display + color persists)
  prevTotal: number | null
  // timestamp when the last change happened
  lastChangeAt: number | null
}

type RowsState = Record<KaratKey, KaratRowState>

type Props = {
  ounceUsd: number | null
  onMainMarginSync?: (marginIqd: number) => void
  externalMarginIqd?: number
}

const ROWS_STORAGE_KEY = 'karatRows_v2'

const DEFAULT_ROWS: RowsState = {
  '24k': { lastTotal: null, prevTotal: null, lastChangeAt: null },
  '22k': { lastTotal: null, prevTotal: null, lastChangeAt: null },
  '21k': { lastTotal: null, prevTotal: null, lastChangeAt: null },
  '18k': { lastTotal: null, prevTotal: null, lastChangeAt: null },
}

export default function KaratsCard({ ounceUsd, onMainMarginSync, externalMarginIqd }: Props) {
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

  // Per-karat independent gain/loss tracking (persisted)
  const [rows, setRows] = React.useState<RowsState>(() => {
    const saved = getJSON<RowsState>(ROWS_STORAGE_KEY, DEFAULT_ROWS)
    // ensure all keys exist
    return { ...DEFAULT_ROWS, ...saved }
  })

  // IMPORTANT:
  // update prev/last ONLY when the computed TOTAL for that row changes
  // this makes EACH KARAT have its own independent delta & percent
  React.useEffect(() => {
    if (ounceUsd == null) return

    setRows((prev) => {
      const next: RowsState = { ...prev }

      for (const k of KARATS) {
        const p = priceForKarat(ounceUsd, k, unit, usdToIqd, effectiveMargin)
        const currTotal = p.total

        const prevRow = prev[k] ?? DEFAULT_ROWS[k]
        const lastTotal = prevRow.lastTotal

        // seed first time (no delta yet)
        if (lastTotal == null) {
          next[k] = {
            lastTotal: currTotal,
            prevTotal: null,
            lastChangeAt: Date.now(),
          }
          continue
        }

        // update only if changed
        if (currTotal !== lastTotal) {
          next[k] = {
            lastTotal: currTotal,
            prevTotal: lastTotal,
            lastChangeAt: Date.now(),
          }
        } else {
          next[k] = prevRow
        }
      }

      setJSON(ROWS_STORAGE_KEY, next)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ounceUsd, unit, usdToIqdText, marginIqd])

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
          const p = ounceUsd == null ? null : priceForKarat(ounceUsd, k, unit, usdToIqd, effectiveMargin)

          const currency = p?.currency ?? 'USD'
          const decimals = currency === 'IQD' ? 0 : 2

          const currTotal = p?.total ?? 0
          const prevTotal = rows[k]?.prevTotal ?? null

          const { delta, pct } = deltaAndPercent(currTotal, prevTotal)
          const { arrow, tone } = arrowForDelta(delta)
          const cls = tone === 'up' ? 'chgUp' : tone === 'down' ? 'chgDown' : 'chgFlat'

          const money = p ? formatMoney(p.total, currency, decimals) : '—'
          const deltaMoney = p ? formatMoney(delta, currency, decimals) : '—'

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
