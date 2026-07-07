import type { AccentKey } from './types'

/**
 * Validated categorical data-viz palette (light mode), in fixed slot order.
 * Categorical hues are always assigned in this order, never cycled.
 */
export const CATEGORICAL: string[] = [
  '#2a78d6', // blue
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
  '#e87ba4', // magenta
  '#eb6834', // orange
]

/** Sequential blue ramp, light → dark (magnitude). Lightest ≈ near zero. */
export const SEQ_BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']

export const CHROME = {
  surface: '#fcfcfb',
  grid: '#e1e0d9',
  baseline: '#c3c2b7',
  muted: '#898781',
  secondary: '#52514e',
  primary: '#0b0b0b',
  zeroCell: '#f0efec',
  deltaGood: '#006300',
  deltaBad: '#c22a2a',
}

export interface Accent {
  key: AccentKey
  label: string
  color: string
  /** soft tint for icon chips / widget headers */
  tint: string
}

export const ACCENTS: Accent[] = [
  { key: 'blue', label: 'Blue', color: '#2a78d6', tint: 'rgba(42,120,214,0.10)' },
  { key: 'teal', label: 'Teal', color: '#1baf7a', tint: 'rgba(27,175,122,0.12)' },
  { key: 'amber', label: 'Amber', color: '#c98500', tint: 'rgba(237,161,0,0.14)' },
  { key: 'green', label: 'Green', color: '#008300', tint: 'rgba(0,131,0,0.10)' },
  { key: 'violet', label: 'Violet', color: '#4a3aa7', tint: 'rgba(74,58,167,0.10)' },
  { key: 'red', label: 'Red', color: '#e34948', tint: 'rgba(227,73,72,0.10)' },
  { key: 'magenta', label: 'Magenta', color: '#d55181', tint: 'rgba(232,123,164,0.13)' },
  { key: 'orange', label: 'Orange', color: '#eb6834', tint: 'rgba(235,104,52,0.11)' },
]

export function accent(key: AccentKey): Accent {
  return ACCENTS.find((a) => a.key === key) ?? ACCENTS[0]
}
