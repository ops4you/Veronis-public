import { useState } from 'react'
import type { HeatmapData } from '../../lib/analytics'
import { CHROME, SEQ_BLUE } from '../../lib/palette'
import { DAY_NAMES, fmtHour } from '../../lib/format'
import { ChartTooltip, type TooltipState } from './ChartTooltip'

interface Props {
  heat: HeatmapData
  formatValue: (v: number) => string
}

/**
 * Week × hour revenue heatmap. Sequential single-hue ramp (light → dark);
 * open hours with zero sales sit on the neutral zero tone and get a hairline
 * ring when they were empty in most weeks — those are the dead hours.
 */
export function Heatmap({ heat, formatValue }: Props) {
  const [tip, setTip] = useState<TooltipState | null>(null)
  const { cells, days, hours, max } = heat

  const cellFor = (day: number, hour: number) => cells.find((c) => c.day === day && c.hour === hour)

  const colorOf = (revenue: number) => {
    if (revenue <= 0) return CHROME.zeroCell
    const idx = Math.min(SEQ_BLUE.length - 1, Math.floor((revenue / max) * SEQ_BLUE.length))
    return SEQ_BLUE[idx]
  }

  return (
    <div className="relative flex h-full flex-col justify-center">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `2.2rem repeat(${hours.length}, minmax(0, 1fr))` }}
        role="img"
        aria-label="Revenue by weekday and hour"
      >
        {days.map((day, rowIdx) => (
          <div key={day} className="contents">
            <div className="flex items-center pr-1 text-[10px] font-medium text-stone-500">{DAY_NAMES[day]}</div>
            {hours.map((hour, colIdx) => {
              const cell = cellFor(day, hour)
              const rev = cell?.revenue ?? 0
              const isDead = !!cell && cell.occurrences >= 2 && cell.emptyOccurrences / cell.occurrences >= 0.75
              return (
                <div
                  key={hour}
                  className="h-5 rounded-[3px]"
                  style={{
                    background: colorOf(rev),
                    boxShadow: isDead ? `inset 0 0 0 1px ${CHROME.baseline}` : undefined,
                  }}
                  onMouseEnter={() =>
                    setTip({
                      xPct: ((colIdx + 1) / (hours.length + 1)) * 100,
                      yPct: (rowIdx / days.length) * 80,
                      title: `${DAY_NAMES[day]} ${fmtHour(hour)}–${fmtHour(hour + 1)}`,
                      lines: [
                        rev > 0 ? `${formatValue(rev)} · ${cell?.orders ?? 0} orders` : 'No sales',
                        cell && cell.emptyOccurrences > 0
                          ? `Empty ${cell.emptyOccurrences} of ${cell.occurrences} times`
                          : `Busy all ${cell?.occurrences ?? 0} times`,
                      ],
                    })
                  }
                  onMouseLeave={() => setTip(null)}
                />
              )
            })}
          </div>
        ))}
        {/* hour axis: label every 2 hours */}
        <div />
        {hours.map((hour) => (
          <div key={hour} className="pt-0.5 text-center text-[9px] text-stone-400">
            {hour % 2 === 0 ? `${hour}h` : ''}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[10px] text-stone-500">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-[3px]" style={{ background: CHROME.zeroCell, boxShadow: `inset 0 0 0 1px ${CHROME.baseline}` }} />
          No sales (dead hour)
        </span>
        <span className="flex items-center gap-1">
          Low
          {[0, 2, 4, 6].map((i) => (
            <span key={i} className="h-3 w-3 rounded-[3px]" style={{ background: SEQ_BLUE[i] }} />
          ))}
          High
        </span>
      </div>
      <ChartTooltip tip={tip} />
    </div>
  )
}
