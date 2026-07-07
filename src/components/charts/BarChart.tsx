import { useState } from 'react'
import { CHROME } from '../../lib/palette'
import { ChartTooltip, type TooltipState } from './ChartTooltip'

export interface BarDatum {
  label: string
  value: number
  /** extra tooltip line, e.g. "12 orders" */
  sub?: string
}

interface Props {
  data: BarDatum[]
  color: string
  formatValue: (v: number) => string
  height?: number
}

/** Clean tick step: 1/2/2.5/5 × 10^n covering the max in ≤4 ticks. */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0]
  const raw = max / 3
  const pow = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s * 3 >= max) ?? 10 * pow
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

/** Bar with a 4px rounded data-end and a square baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
}

export function BarChart({ data, color, formatValue, height = 190 }: Props) {
  const [tip, setTip] = useState<TooltipState | null>(null)
  const W = 600
  const H = height
  const M = { top: 8, right: 8, bottom: 22, left: 44 }
  const iw = W - M.left - M.right
  const ih = H - M.top - M.bottom

  const max = Math.max(...data.map((d) => d.value), 1)
  const ticks = niceTicks(max)
  const yMax = ticks[ticks.length - 1] || 1

  const n = data.length
  const band = iw / Math.max(n, 1)
  const barW = Math.min(24, Math.max(4, band - 2)) // ≤24px thick, ≥2px gap between neighbours
  const y = (v: number) => M.top + ih - (v / yMax) * ih

  // Label every k-th bar so x labels never crowd
  const every = Math.ceil(n / 10)

  if (data.every((d) => d.value === 0)) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-stone-400">
        No sales in this period yet
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Bar chart">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHROME.baseline : CHROME.grid} strokeWidth={1} />
            <text x={M.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill={CHROME.muted} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t >= 1000 ? `${(t / 1000).toLocaleString()}k` : t.toLocaleString()}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = M.left + i * band + band / 2
          const bx = cx - barW / 2
          const by = y(d.value)
          const bh = M.top + ih - by
          return (
            <g key={i}>
              {d.value > 0 && <path d={barPath(bx, by, barW, Math.max(bh, 1))} fill={color} />}
              {/* generous invisible hit target for hover/tap */}
              <rect
                x={M.left + i * band}
                y={M.top}
                width={band}
                height={ih}
                fill="transparent"
                onMouseEnter={() =>
                  setTip({
                    xPct: (cx / W) * 100,
                    yPct: ((by - 6) / H) * 100,
                    title: d.label,
                    lines: [formatValue(d.value), ...(d.sub ? [d.sub] : [])],
                  })
                }
                onMouseLeave={() => setTip(null)}
              />
              {i % every === 0 && (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize={10} fill={CHROME.muted}>
                  {d.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  )
}
