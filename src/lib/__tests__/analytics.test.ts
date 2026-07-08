import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  avgTicket,
  categoryMix,
  dailyTotals,
  deadSlotPhrases,
  deadSlots,
  downsample,
  hourHeatmap,
  hourlyTotals,
  paymentMix,
  pctChange,
  periodRange,
  previousRange,
  salesByEmployee,
  salesIn,
  sumSales,
  topProducts,
  weekdayAverages,
} from '../analytics'
import type { Category, OpeningHours, Product, Sale } from '../types'

const DAY = 86_400_000

// Fixed "now": Tuesday 2026-07-07 18:00 local time
const NOW = new Date(2026, 6, 7, 18, 0, 0).getTime()

function sale(at: number, total: number, lines: Partial<Sale['lines'][number]>[] = [], method: 'cash' | 'card' = 'card'): Sale {
  return {
    id: `s-${at}-${Math.random()}`,
    at,
    total,
    method,
    lines: lines.map((l, i) => ({
      productId: l.productId ?? `p${i}`,
      name: l.name ?? `Product ${i}`,
      qty: l.qty ?? 1,
      unitPrice: l.unitPrice ?? total,
      unit: l.unit,
    })),
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.useRealTimers()
})

describe('periodRange / previousRange', () => {
  it('today starts at local midnight and ends now', () => {
    const r = periodRange('today', NOW)
    expect(new Date(r.from).getHours()).toBe(0)
    expect(r.to).toBe(NOW)
    expect(new Date(r.from).getDate()).toBe(7)
  })

  it('7d spans 7 calendar days including today', () => {
    const r = periodRange('7d', NOW)
    expect(new Date(r.from).getDate()).toBe(1) // July 1
    expect(r.to).toBe(NOW)
  })

  it('previousRange is the equal-length window immediately before', () => {
    const r = periodRange('7d', NOW)
    const prev = previousRange(r)
    expect(prev.to).toBe(r.from)
    expect(prev.to - prev.from).toBe(r.to - r.from)
  })
})

describe('sums and deltas', () => {
  it('sumSales and avgTicket', () => {
    const sales = [sale(NOW - 1000, 10), sale(NOW - 2000, 20)]
    expect(sumSales(sales)).toBe(30)
    expect(avgTicket(sales)).toBe(15)
    expect(avgTicket([])).toBe(0)
  })

  it('pctChange handles zero base as null (no meaningless deltas)', () => {
    expect(pctChange(120, 100)).toBeCloseTo(20)
    expect(pctChange(80, 100)).toBeCloseTo(-20)
    expect(pctChange(10, 0)).toBeNull()
  })

  it('salesIn is inclusive of range bounds', () => {
    const s = sale(NOW, 5)
    expect(salesIn([s], { from: NOW, to: NOW })).toHaveLength(1)
  })
})

describe('dailyTotals / hourlyTotals / downsample', () => {
  it('zero-fills every day in the range', () => {
    const r = periodRange('7d', NOW)
    const pts = dailyTotals([], r)
    expect(pts).toHaveLength(7)
    expect(pts.every((p) => p.total === 0)).toBe(true)
  })

  it('buckets sales into the right day', () => {
    const r = periodRange('7d', NOW)
    const monday6 = new Date(2026, 6, 6, 12, 0).getTime()
    const pts = dailyTotals([sale(monday6, 42)], r)
    expect(pts[5].total).toBe(42) // July 6 is the 6th of 7 days (index 5)
    expect(pts.filter((p) => p.total > 0)).toHaveLength(1)
  })

  it('hourlyTotals only creates buckets up to "now"', () => {
    const r = periodRange('today', NOW)
    const pts = hourlyTotals([sale(new Date(2026, 6, 7, 9, 30).getTime(), 7)], r)
    expect(pts).toHaveLength(19) // 00:00 … 18:00
    expect(pts[9].total).toBe(7)
  })

  it('downsample preserves the total sum', () => {
    const values = Array.from({ length: 90 }, (_, i) => i)
    const down = downsample(values, 12)
    expect(down).toHaveLength(12)
    expect(down.reduce((a, b) => a + b, 0)).toBe(values.reduce((a, b) => a + b, 0))
  })

  it('downsample leaves short series untouched', () => {
    expect(downsample([1, 2, 3], 12)).toEqual([1, 2, 3])
  })
})

describe('topProducts / categoryMix / paymentMix', () => {
  const products: Product[] = [
    { id: 'a', name: 'A', price: 1, categoryId: 'c1', active: true, unit: 'each' },
    { id: 'b', name: 'B', price: 2, categoryId: 'c2', active: true, unit: 'each' },
  ]
  const categories: Category[] = [
    { id: 'c1', name: 'Cat 1' },
    { id: 'c2', name: 'Cat 2' },
  ]

  it('ranks products by revenue and aggregates quantities', () => {
    const sales = [
      sale(NOW, 10, [{ productId: 'a', name: 'A', qty: 2, unitPrice: 1 }]),
      sale(NOW, 10, [{ productId: 'b', name: 'B', qty: 3, unitPrice: 2 }]),
      sale(NOW, 10, [{ productId: 'a', name: 'A', qty: 1, unitPrice: 1 }]),
    ]
    const top = topProducts(sales, 5)
    expect(top[0].productId).toBe('b') // 6 € beats 3 €
    expect(top[0].revenue).toBe(6)
    expect(top[1].qty).toBe(3)
  })

  it('folds small categories into "Other" beyond max', () => {
    const manyCats: Category[] = Array.from({ length: 8 }, (_, i) => ({ id: `c${i}`, name: `Cat ${i}` }))
    const manyProds: Product[] = manyCats.map((c, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      price: 1,
      categoryId: c.id,
      active: true,
      unit: 'each',
    }))
    const sales = manyProds.map((p, i) =>
      sale(NOW, 8 - i, [{ productId: p.id, name: p.name, qty: 1, unitPrice: 8 - i }]),
    )
    const mix = categoryMix(sales, manyProds, manyCats, 5)
    expect(mix).toHaveLength(5)
    expect(mix[4].name).toBe('Other')
    const total = mix.reduce((acc, m) => acc + m.value, 0)
    expect(total).toBe(sales.reduce((acc, s) => acc + s.total, 0))
  })

  it('splits payments by method', () => {
    const sales = [sale(NOW, 10, [], 'cash'), sale(NOW, 30, [], 'card'), sale(NOW, 5, [], 'cash')]
    expect(paymentMix(sales)).toEqual({ cash: 15, card: 30 })
  })
})

describe('salesByEmployee', () => {
  it('groups revenue and orders per employee, biggest first', () => {
    const sales: Sale[] = [
      { ...sale(NOW, 10), employeeId: 'e1', employeeName: 'Ana' },
      { ...sale(NOW, 30), employeeId: 'e2', employeeName: 'Miguel' },
      { ...sale(NOW, 15), employeeId: 'e1', employeeName: 'Ana' },
      { ...sale(NOW, 5) }, // unattributed
    ]
    const stats = salesByEmployee(sales)
    expect(stats).toHaveLength(3)
    expect(stats[0]).toMatchObject({ name: 'Miguel', revenue: 30, orders: 1 })
    expect(stats[1]).toMatchObject({ name: 'Ana', revenue: 25, orders: 2 })
    expect(stats[2]).toMatchObject({ name: 'Unassigned', revenue: 5, orders: 1 })
  })

  it('returns empty for no sales', () => {
    expect(salesByEmployee([])).toEqual([])
  })
})

describe('dead hours analysis', () => {
  const opening: OpeningHours = { openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 8, closeHour: 20 }

  /** Sales every open hour of the window EXCEPT Mondays 15:00–16:59. */
  function buildSales(): Sale[] {
    const sales: Sale[] = []
    for (let back = 27; back >= 0; back--) {
      const day = new Date(2026, 6, 7 - back)
      for (let h = 8; h < 20; h++) {
        const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 15).getTime()
        if (at > NOW) continue
        const isMondayDead = day.getDay() === 1 && (h === 15 || h === 16)
        if (isMondayDead) continue
        sales.push(sale(at, 10))
      }
    }
    return sales
  }

  it('counts occurrences and empty occurrences per weekly slot', () => {
    const heat = hourHeatmap(buildSales(), opening, 28, NOW)
    const mon15 = heat.cells.find((c) => c.day === 1 && c.hour === 15)!
    expect(mon15.occurrences).toBeGreaterThanOrEqual(3)
    expect(mon15.emptyOccurrences).toBe(mon15.occurrences)
    expect(mon15.revenue).toBe(0)

    const tue10 = heat.cells.find((c) => c.day === 2 && c.hour === 10)!
    expect(tue10.emptyOccurrences).toBe(0)
    expect(tue10.revenue).toBeGreaterThan(0)
  })

  it('does not count future slots of today as empty', () => {
    const heat = hourHeatmap(buildSales(), opening, 28, NOW)
    // 19:00 today (Tuesday) has not happened at NOW=18:00 — occurrences for
    // Tue 19h must only count past Tuesdays (3, not 4).
    const tue19 = heat.cells.find((c) => c.day === 2 && c.hour === 19)!
    expect(tue19.occurrences).toBe(3)
  })

  it('deadSlots finds exactly the engineered dead slots', () => {
    const heat = hourHeatmap(buildSales(), opening, 28, NOW)
    const dead = deadSlots(heat)
    const asPairs = dead.map((d) => `${d.day}-${d.hour}`)
    expect(asPairs).toContain('1-15')
    expect(asPairs).toContain('1-16')
    expect(dead).toHaveLength(2)
  })

  it('deadSlotPhrases merges consecutive hours into one range', () => {
    const heat = hourHeatmap(buildSales(), opening, 28, NOW)
    const phrases = deadSlotPhrases(deadSlots(heat))
    expect(phrases).toHaveLength(1)
    expect(phrases[0]).toBe('Mon 15:00–17:00')
  })

  it('respects opening hours — closed hours are not analysed', () => {
    const heat = hourHeatmap([], opening, 28, NOW)
    expect(heat.hours[0]).toBe(8)
    expect(heat.hours[heat.hours.length - 1]).toBe(19)
    expect(heat.cells.every((c) => c.hour >= 8 && c.hour < 20)).toBe(true)
  })

  it('weekdayAverages ranks the weakest day first', () => {
    const sales = buildSales().filter((s) => new Date(s.at).getDay() !== 1) // Mondays: zero
    const byDay = weekdayAverages(sales, opening, 28, NOW)
    expect(byDay[0].day).toBe(1)
    expect(byDay[0].avg).toBe(0)
    expect(byDay[byDay.length - 1].avg).toBeGreaterThan(0)
  })
})
