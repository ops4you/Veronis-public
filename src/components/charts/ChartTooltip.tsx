import type { ReactNode } from 'react'

export interface TooltipState {
  xPct: number
  yPct: number
  title: string
  lines: string[]
}

/** Absolute-positioned tooltip; parent must be `position: relative`. */
export function ChartTooltip({ tip }: { tip: TooltipState | null }): ReactNode {
  if (!tip) return null
  const flip = tip.xPct > 62
  return (
    <div
      className="pointer-events-none absolute z-20 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs shadow-card"
      style={{
        left: `${tip.xPct}%`,
        top: `${tip.yPct}%`,
        transform: `translate(${flip ? 'calc(-100% - 8px)' : '8px'}, -50%)`,
      }}
      role="status"
    >
      <div className="font-semibold text-stone-900">{tip.title}</div>
      {tip.lines.map((l, i) => (
        <div key={i} className="text-stone-500">
          {l}
        </div>
      ))}
    </div>
  )
}
