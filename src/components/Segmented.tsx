import React from 'react'

export type SegItem<T extends string> = { key: T; label: string }

export default function Segmented<T extends string>({
  items,
  value,
  onChange,
}: {
  items: SegItem<T>[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg">
      {items.map((it) => (
        <button
          key={it.key}
          className={`segBtn ${it.key === value ? 'segBtnOn' : ''}`}
          onClick={() => onChange(it.key)}
          type="button"
        >
          <span className="segGlow" />
          {it.label}
        </button>
      ))}
    </div>
  )
}
