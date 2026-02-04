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
 * Formats a numeric string with thousands separators while keeping an optional decimal part.
 * Examples:
 *  - "1500" -> "1,500"
 *  - "1500." -> "1,500."
 *  - "1500.25" -> "1,500.25"
 */
function formatWithGrouping(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, '')
  if (cleaned === '') return ''

  // keep only the first dot
  const firstDot = cleaned.indexOf('.')
  let intPart = cleaned
  let decPart = ''
  let hasDot = false

  if (firstDot !== -1) {
    hasDot = true
    intPart = cleaned.slice(0, firstDot)
    decPart = cleaned.slice(firstDot + 1).replace(/\./g, '')
  }

  // remove leading zeros nicely (but keep single zero if empty)
  intPart = intPart.replace(/^0+(?=\d)/, '')

  const grouped = intPart === '' ? '0' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(intPart))

  if (hasDot) return decPart.length ? `${grouped}.${decPart}` : `${grouped}.`
  return grouped
}

export default function NumberInput({ label, value, placeholder, onChange, hint, suffix }: Props) {
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
        pattern="[0-9.,]*"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          const nextRaw = e.target.value.replace(/[^\d.,]/g, '')
          // normalize commas away, then format with grouping
          const normalized = nextRaw.replace(/,/g, '')
          const formatted = formatWithGrouping(normalized)
          onChange(formatted)
        }}
      />

      {hint ? <div className="fieldHint">{hint}</div> : null}
    </label>
  )
}
