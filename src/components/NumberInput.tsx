import React from 'react'
import { parseLooseNumber } from '../lib/format'

type Props = {
  label: string
  value: string
  placeholder?: string
  onChange: (v: string) => void
  hint?: string
  suffix?: string
}

/**
 * Format numeric string with commas while typing.
 * Keeps decimals if present.
 * Examples:
 *  "1234"      -> "1,234"
 *  "1234.56"   -> "1,234.56"
 *  "001234"    -> "1,234"
 */
function formatWithCommasLive(input: string): string {
  if (!input) return ''

  // remove commas first
  const cleaned = input.replace(/,/g, '')

  // split decimal part
  const [intPart, decPart] = cleaned.split('.')

  // format integer part
  const intFormatted = intPart
    .replace(/^0+(?=\d)/, '') // remove leading zeros
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')

  // re-attach decimal if exists
  return decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted
}

export default function NumberInput({
  label,
  value,
  placeholder,
  onChange,
  hint,
  suffix,
}: Props) {
  const invalid = value.trim() !== '' && parseLooseNumber(value) == null

  return (
    <label className="field">
      <div className="fieldTop">
        <span className="fieldLabel">{label}</span>
        {suffix ? <span className="fieldSuffix">{suffix}</span> : null}
      </div>

      <input
        className={`input ${invalid ? 'inputInvalid' : ''}`}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          // allow only digits and dot
          const raw = e.target.value.replace(/[^\d.]/g, '')

          // prevent more than one dot
          const parts = raw.split('.')
          const safe =
            parts.length > 2
              ? `${parts[0]}.${parts.slice(1).join('')}`
              : raw

          // format with commas
          const formatted = formatWithCommasLive(safe)

          onChange(formatted)
        }}
      />

      {hint ? <div className="fieldHint">{hint}</div> : null}
    </label>
  )
}
