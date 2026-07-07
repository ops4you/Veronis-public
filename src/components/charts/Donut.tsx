import { useState } from 'react'
import { CATEGORICAL } from '../../lib/palette'
import type { MixSlice } from '../../lib/analytics'

interface Props {
  slices: MixSlice[]
  formatValue: (v: number) => string
}

/** Donut with 2px surface gaps between segments and a swatch legend. */
export function Donut({ slices, formatValue }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const total = slices.reduce((acc, s) => acc + s.value, 0)
  if (total === 0 || slices.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-stone-400">No sales in this period yet</div>
  }
  const R = 42
  const STROKE = 18
  const C = 2 * Math.PI * R
  let offset = 0
  const segs = slices.map((s, i) => {
    const frac = s.value / total
    const seg = { ...s, frac, start: offset, color: CATEGORICAL[i % CATEGORICAL.length] }
    offset += frac
    return seg
  })
  return (
    <div className="flex h-full items-center justify-center gap-5">
      <div className="relative shrink-0">
        <svg width={120} height={120} viewBox="0 0 120 120" role="img" aria-label="Revenue share by category">
          <g transform="rotate(-90 60 60)">
            {segs.map((s, i) => (
              <circle
                key={s.name}
                cx={60}
                cy={60}
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth={active === null || active === i ? STROKE : STROKE - 4}
                strokeDasharray={`${Math.max(s.frac * C - 2, 0.5)} ${C}`}
                strokeDashoffset={-s.start * C}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                style={{ transition: 'stroke-width 150ms ease-out', cursor: 'default' }}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-stone-500">{active !== null ? segs[active].name : 'Total'}</span>
          <span className="text-sm font-semibold text-stone-900">
            {formatValue(active !== null ? segs[active].value : total)}
          </span>
        </div>
      </div>
      <ul className="min-w-0 space-y-1.5">
        {segs.map((s, i) => (
          <li
            key={s.name}
            className="flex items-center gap-2 text-xs"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
            <span className="truncate text-stone-600">{s.name}</span>
            <span className="ml-auto pl-2 font-medium text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(s.frac * 100)}%
            </span>
          </li>
        ))}
      </ul>
      <span className="sr-only">
        {segs.map((s) => `${s.name}: ${formatValue(s.value)} (${Math.round(s.frac * 100)}%)`).join(', ')}
      </span>
    </div>
  )
}
