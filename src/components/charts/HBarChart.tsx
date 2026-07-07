import { CHROME } from '../../lib/palette'

export interface HBarDatum {
  name: string
  value: number
  sub?: string
}

interface Props {
  data: HBarDatum[]
  color: string
  formatValue: (v: number) => string
}

/** Horizontal bars with the value directly labeled at the bar tip. */
export function HBarChart({ data, color, formatValue }: Props) {
  const max = Math.max(...data.map((d) => d.value), 1)
  if (data.length === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-stone-400">No sales in this period yet</div>
  }
  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {data.map((d) => (
        <div key={d.name} className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
          <div className="truncate text-right text-xs text-stone-600" title={d.name}>
            {d.name}
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 flex-1 overflow-visible">
              <div
                className="h-4 rounded-r"
                style={{
                  width: `${Math.max((d.value / max) * 100, 1)}%`,
                  background: color,
                  borderRadius: '0 4px 4px 0',
                }}
              />
            </div>
            <div
              className="w-20 shrink-0 text-xs font-medium text-stone-900"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatValue(d.value)}
              {d.sub && <span className="ml-1 font-normal text-stone-400">{d.sub}</span>}
            </div>
          </div>
        </div>
      ))}
      <div className="mt-0.5 h-px w-full" style={{ background: CHROME.grid }} />
    </div>
  )
}
