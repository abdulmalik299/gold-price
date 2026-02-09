import React from 'react'
import Segmented from './Segmented'
import NumberInput from './NumberInput'
import { KaratKey, UnitKey, priceForKarat } from '../lib/calc'
import { formatMoney, parseLooseNumber } from '../lib/format'
import { getJSON, setJSON } from '../lib/storage'
import { useI18n } from '../lib/i18n'

const KARATS: KaratKey[] = ['24k', '22k', '21k', '18k']

type Props = {
  ounceUsd: number | null
  onMainMarginSync?: (marginIqd: number) => void
  externalMarginIqd?: number
}

export default function KaratsCard({ ounceUsd, onMainMarginSync, externalMarginIqd }: Props) {
  const { t } = useI18n()
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
        <div className="cardTitle">{t('karatsTitle')}</div>
        <div className="inlineRight">
          <Segmented
            items={[
              { key: 'mithqal', label: t('mithqal') },
              { key: 'gram', label: t('gram') },
            ]}
            value={unit}
            onChange={(v) => setUnit(v)}
          />
        </div>
      </div>

      <div className="karatInputs">
        <NumberInput
          id="karats-usd-to-iqd"
          name="karatsUsdToIqd"
          label={t('usdToIqd')}
          value={usdToIqdText}
          onChange={setUsdToIqdText}
          placeholder={t('leaveEmptyForUsd')}
          hint={t('karatsHint')}
          suffix={marginEnabled ? 'IQD' : '$'}
        />
      </div>

      <div className="karatList">
        {KARATS.map((k) => {
          // CURRENT total (based on latest market ounceUsd)
          const pNow =
            ounceUsd == null ? null : priceForKarat(ounceUsd, k, unit, usdToIqd, effectiveMargin)

          const currency = pNow?.currency ?? (usdToIqd && usdToIqd > 0 ? 'IQD' : 'USD')
          const decimals = currency === 'IQD' ? 0 : 2

          const money = pNow ? formatMoney(pNow.total, currency, decimals) : '—'

          return (
            <div className="karatRow" key={k}>
              <div className="karatK">{k.toUpperCase()}</div>
              <div className="karatV">
                <div className="karatPrice">{money}</div>
                {!pNow ? <div className="mutedTiny">{t('waiting')}</div> : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="sliderWrap">
        <div className="sliderTop">
          <div className="sliderLabel">{t('marginTax')}</div>
          <div className="sliderVal">
            {marginEnabled ? `${marginIqd.toLocaleString('en-US')} IQD` : t('enableByEnteringUsdToIqd')}
          </div>
        </div>

        <input
          id="karat-margin-iqd"
          name="karatMarginIqd"
          aria-label={t('marginTax')}
          type="range"
          min={0}
          max={70000}
          step={1000}
          value={marginIqd}
          disabled={!marginEnabled}
          onChange={(e) => onSlider(Number(e.target.value))}
          className="slider"
        />

        <div className="mutedTiny">{t('sliderWorksNote')}</div>
      </div>
    </div>
  )
}
