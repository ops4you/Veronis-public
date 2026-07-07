import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { CHROME } from '../../lib/palette'
import { Sparkline } from '../charts/Sparkline'

interface Props {
  value: string
  /** % change vs the previous equal period; null hides the delta */
  deltaPct: number | null
  deltaLabel: string
  /** whether an increase is good news (income yes, expenses no) */
  upIsGood: boolean
  trend: number[]
  accentColor: string
}

/** Stat-tile body per the dataviz contract: value · signed delta · sparkline. */
export function StatTile({ value, deltaPct, deltaLabel, upIsGood, trend, accentColor }: Props) {
  const up = (deltaPct ?? 0) >= 0
  const good = deltaPct === null ? true : up === upIsGood
  return (
    <div className="flex h-full flex-col justify-end gap-1.5">
      <div className="text-[1.7rem] font-semibold leading-none text-stone-900">{value}</div>
      <div className="flex items-end justify-between gap-2">
        <div className="text-xs text-stone-500">
          {deltaPct !== null ? (
            <span className="inline-flex items-center gap-0.5">
              <span
                className="inline-flex items-center gap-0.5 font-medium"
                style={{ color: good ? CHROME.deltaGood : CHROME.deltaBad }}
              >
                {up ? <ArrowUpRight size={13} aria-label="up" /> : <ArrowDownRight size={13} aria-label="down" />}
                {Math.abs(deltaPct).toFixed(0)}%
              </span>
              <span className="ml-1">{deltaLabel}</span>
            </span>
          ) : (
            <span>{deltaLabel}</span>
          )}
        </div>
        <Sparkline points={trend} accentColor={accentColor} />
      </div>
    </div>
  )
}
