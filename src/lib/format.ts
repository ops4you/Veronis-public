function getLocale() {
  return i18n.getLanguage() === 'pt' ? 'pt-PT' : 'en-US'
}

export function fmtMoney(value: number, currency: string): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value)
}

/** Compact money for stat tiles: 1.2K, 40.5K … */
export function fmtMoneyCompact(value: number, currency: string): string {
  if (Math.abs(value) >= 10000) {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value)
}

export function fmtNumber(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value)
}

export function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' })
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' })
}

export function fmtDateLong(ts: number): string {
  return new Date(ts).toLocaleDateString(getLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`
}

export function fmtElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

import { i18n } from './i18n'

export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const DAY_NAMES = new Proxy([] as string[], {
  get(_, prop) {
    const idx = Number(prop)
    if (!isNaN(idx)) {
      const lang = i18n.getLanguage()
      return lang === 'pt' ? DAY_NAMES_PT[idx] : DAY_NAMES_EN[idx]
    }
    if (prop === 'length') return 7
    if (prop === 'map') {
      return (cb: (val: string, index: number) => any) => {
        const lang = i18n.getLanguage()
        const arr = lang === 'pt' ? DAY_NAMES_PT : DAY_NAMES_EN
        return arr.map(cb)
      }
    }
    return (DAY_NAMES_EN as any)[prop]
  }
})

export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
