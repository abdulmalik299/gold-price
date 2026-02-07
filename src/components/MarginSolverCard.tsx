import React from 'react'
import NumberInput from './NumberInput'
import { priceForKarat } from '../lib/calc'
import { formatMoney, parseLooseNumber } from '../lib/format'
import { useI18n } from '../lib/i18n'

export default function MarginSolverCard({
  onSolvedMargin,
}: {
  onSolvedMargin: (marginIqd: number) => void
}) {
  const { t } = useI18n()
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
        <div className="cardTitle">{t('taxMarginSolveTitle')}</div>
        <div className="pill subtle">{t('autoSyncSlider')}</div>
      </div>

      <div className="grid2">
        <NumberInput
          label={t('localOuncePriceUsd')}
          value={ounceText}
          onChange={setOunceText}
          placeholder={t('localOuncePlaceholder')}
          hint={t('localOunceHint')}
          suffix="$"
        />
        <NumberInput
          label={t('usdToIqd')}
          value={usdToIqdText}
          onChange={setUsdToIqdText}
          placeholder={t('placeholderUsdToIqd')}
          hint={t('usdToIqdHint')}
          suffix="IQD"
        />
      </div>

      <NumberInput
        label={t('local21PerMithqal')}
        value={local21Text}
        onChange={setLocal21Text}
        placeholder={t('local21Placeholder')}
        hint={t('local21Hint')}
        suffix="IQD"
      />

      <div className="solverOut">
        <div className="kv">
          <div className="k">{t('theoretical21k')}</div>
          <div className="v">{theoretical == null ? '—' : formatMoney(theoretical, 'IQD', 0)}</div>
        </div>
        <div className="kv">
          <div className="k">{t('marginResult')}</div>
          <div className="v">{margin == null ? '—' : formatMoney(margin, 'IQD', 0)}</div>
        </div>

        <button
          className="btn"
          type="button"
          disabled={margin == null || !Number.isFinite(margin)}
          onClick={() => onSolvedMargin(Math.max(0, margin ?? 0))}
        >
          <span className="btnGlow" />
          {t('applyMarginMainSlider')}
        </button>
      </div>

      <div className="mutedTiny">{t('marginSolveNote')}</div>
    </div>
  )
}
