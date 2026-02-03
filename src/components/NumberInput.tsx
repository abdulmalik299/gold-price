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
          // allow only digits, commas, dot
          const next = e.target.value.replace(/[^\d.,]/g, '')
          onChange(next)
        }}
      />
      {hint ? <div className="fieldHint">{hint}</div> : null}
    </label>
  )
}
