import { CHROME } from '../../lib/palette'

interface Props {
  points: number[]
  accentColor: string
}

/**
 * Stat-tile trend: 2px line in the de-emphasis hue, current point marked
 * with an accent dot wearing a 2px surface ring.
 */
export function Sparkline({ points, accentColor }: Props) {
  const W = 120
  const H = 36
  const PAD = 4
  if (points.length < 2) return <div style={{ width: W, height: H }} />
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const span = max - min || 1
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2)
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2)
  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const lastX = x(points.length - 1)
  const lastY = y(points[points.length - 1])
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="shrink-0">
      <path d={d} fill="none" stroke={CHROME.baseline} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={5} fill={CHROME.surface} />
      <circle cx={lastX} cy={lastY} r={3.5} fill={accentColor} />
    </svg>
  )
}
