import type { Category, Expense, OpeningHours, Period, Product, Sale } from './types'
import { startOfDay, DAY_NAMES, fmtHour } from './format'

export interface Range {
  from: number
  to: number
}

const DAY_MS = 86_400_000

export function periodRange(period: Period, now = Date.now()): Range {
  const today = startOfDay(now)
  switch (period) {
    case 'today':
      return { from: today, to: now }
    case '7d':
      return { from: today - 6 * DAY_MS, to: now }
    case '30d':
      return { from: today - 29 * DAY_MS, to: now }
    case '90d':
      return { from: today - 89 * DAY_MS, to: now }
  }
}

/** The equal-length period immediately before `r`, for deltas. */
export function previousRange(r: Range): Range {
  const len = r.to - r.from
  return { from: r.from - len, to: r.from }
}

export function periodLabel(period: Period): string {
  return period === 'today' ? 'today' : period === '7d' ? 'last 7 days' : period === '30d' ? 'last 30 days' : 'last 90 days'
}

export function prevPeriodLabel(period: Period): string {
  return period === 'today' ? 'vs yesterday' : 'vs previous period'
}

export function salesIn(sales: Sale[], r: Range): Sale[] {
  return sales.filter((s) => s.at >= r.from && s.at <= r.to)
}

export function expensesIn(expenses: Expense[], r: Range): Expense[] {
  return expenses.filter((e) => e.at >= r.from && e.at <= r.to)
}

export function sumSales(sales: Sale[]): number {
  return sales.reduce((acc, s) => acc + s.total, 0)
}

export function sumExpenses(expenses: Expense[]): number {
  return expenses.reduce((acc, e) => acc + e.amount, 0)
}

export function avgTicket(sales: Sale[]): number {
  return sales.length === 0 ? 0 : sumSales(sales) / sales.length
}

/** Percentage change; null when the base is 0 (no meaningful delta). */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export interface DayPoint {
  date: number
  label: string
  total: number
}

interface Timed {
  at: number
  total: number
}

/** One point per day across the range (inclusive), zero-filled. */
export function dailyTotals(items: Timed[], r: Range): DayPoint[] {
  const from = startOfDay(r.from)
  const points: DayPoint[] = []
  for (let t = from; t <= r.to; t += DAY_MS) {
    points.push({ date: t, label: '', total: 0 })
  }
  for (const s of items) {
    if (s.at < r.from || s.at > r.to) continue
    const idx = Math.floor((startOfDay(s.at) - from) / DAY_MS)
    if (points[idx]) points[idx].total += s.total
  }
  for (const p of points) {
    const d = new Date(p.date)
    p.label = `${d.getDate()}/${d.getMonth() + 1}`
  }
  return points
}

/** One point per hour of today, zero-filled, for the "today" views. */
export function hourlyTotals(items: Timed[], r: Range): DayPoint[] {
  const points: DayPoint[] = []
  const start = new Date(r.from)
  for (let h = 0; h < 24; h++) {
    const t = new Date(start)
    t.setHours(h, 0, 0, 0)
    if (t.getTime() > r.to) break
    points.push({ date: t.getTime(), label: fmtHour(h), total: 0 })
  }
  for (const s of items) {
    if (s.at < r.from || s.at > r.to) continue
    const h = new Date(s.at).getHours()
    if (points[h]) points[h].total += s.total
  }
  return points
}

/** Collapse a series to at most `target` points (chunk sums) for sparklines. */
export function downsample(values: number[], target = 12): number[] {
  if (values.length <= target) return values
  const chunk = values.length / target
  const out: number[] = []
  for (let i = 0; i < target; i++) {
    const from = Math.floor(i * chunk)
    const to = Math.floor((i + 1) * chunk)
    out.push(values.slice(from, Math.max(to, from + 1)).reduce((a, b) => a + b, 0))
  }
  return out
}

export interface ProductStat {
  productId: string
  name: string
  qty: number
  revenue: number
}

export function topProducts(sales: Sale[], n: number): ProductStat[] {
  const map = new Map<string, ProductStat>()
  for (const s of sales) {
    for (const l of s.lines) {
      const cur = map.get(l.productId) ?? { productId: l.productId, name: l.name, qty: 0, revenue: 0 }
      cur.qty += l.qty
      cur.revenue += l.qty * l.unitPrice
      map.set(l.productId, cur)
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, n)
}

export interface MixSlice {
  name: string
  value: number
}

/** Revenue share per category; categories beyond `max` fold into "Other". */
export function categoryMix(
  sales: Sale[],
  products: Product[],
  categories: Category[],
  max = 5,
): MixSlice[] {
  const catOf = new Map(products.map((p) => [p.id, p.categoryId]))
  const totals = new Map<string, number>()
  for (const s of sales) {
    for (const l of s.lines) {
      const catId = catOf.get(l.productId) ?? 'other'
      totals.set(catId, (totals.get(catId) ?? 0) + l.qty * l.unitPrice)
    }
  }
  const named = [...totals.entries()]
    .map(([catId, value]) => ({
      name: categories.find((c) => c.id === catId)?.name ?? 'Other',
      value,
    }))
    .sort((a, b) => b.value - a.value)
  if (named.length <= max) return named
  const head = named.slice(0, max - 1)
  const rest = named.slice(max - 1).reduce((acc, s) => acc + s.value, 0)
  return [...head, { name: 'Other', value: rest }]
}

export interface EmployeeStat {
  employeeId: string | null
  name: string
  revenue: number
  orders: number
}

/** Revenue and order count per employee, biggest earner first. */
export function salesByEmployee(sales: Sale[]): EmployeeStat[] {
  const map = new Map<string, EmployeeStat>()
  for (const s of sales) {
    const key = s.employeeId ?? '—'
    const cur = map.get(key) ?? {
      employeeId: s.employeeId ?? null,
      name: s.employeeName ?? 'Unassigned',
      revenue: 0,
      orders: 0,
    }
    cur.revenue += s.total
    cur.orders += 1
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue)
}

export function paymentMix(sales: Sale[]): { cash: number; card: number } {
  let cash = 0
  let card = 0
  for (const s of sales) {
    if (s.method === 'cash') cash += s.total
    else card += s.total
  }
  return { cash, card }
}

// ---------------------------------------------------------------------------
// Dead hours — the quiet-time analysis
// ---------------------------------------------------------------------------

export interface HeatCell {
  day: number // 0 = Sunday … 6 = Saturday
  hour: number
  revenue: number // total revenue in this weekly slot across the window
  orders: number
  /** number of times this weekly slot occurred in the window */
  occurrences: number
  /** occurrences with zero sales */
  emptyOccurrences: number
}

export interface HeatmapData {
  cells: HeatCell[] // only open days × open hours
  days: number[] // open days present, in Mon-first display order
  hours: number[] // open hours
  max: number // max cell revenue (for the ramp)
  weeks: number
}

/** Revenue per (weekday × hour) over the trailing `windowDays`, open hours only. */
export function hourHeatmap(sales: Sale[], opening: OpeningHours, windowDays = 28, now = Date.now()): HeatmapData {
  const from = startOfDay(now) - (windowDays - 1) * DAY_MS
  const hours: number[] = []
  for (let h = opening.openHour; h < opening.closeHour; h++) hours.push(h)

  // Mon-first ordering reads naturally for a business week
  const displayOrder = [1, 2, 3, 4, 5, 6, 0]
  const days = displayOrder.filter((d) => opening.openDays.includes(d))

  const key = (d: number, h: number) => d * 24 + h
  const map = new Map<number, HeatCell>()
  for (const d of days) {
    for (const h of hours) {
      map.set(key(d, h), { day: d, hour: h, revenue: 0, orders: 0, occurrences: 0, emptyOccurrences: 0 })
    }
  }

  // Count occurrences of each weekday in the window (up to "now" for today)
  const salesBySlot = new Map<string, number>()
  for (const s of sales) {
    if (s.at < from || s.at > now) continue
    const d = new Date(s.at)
    const cell = map.get(key(d.getDay(), d.getHours()))
    if (!cell) continue
    cell.revenue += s.total
    cell.orders += 1
    salesBySlot.set(`${startOfDay(s.at)}-${d.getHours()}`, 1)
  }

  for (let t = from; t <= now; t += DAY_MS) {
    const d = new Date(t)
    const dow = d.getDay()
    if (!opening.openDays.includes(dow)) continue
    for (const h of hours) {
      const slotStart = new Date(t)
      slotStart.setHours(h, 0, 0, 0)
      if (slotStart.getTime() > now) continue // slot hasn't happened yet today
      const cell = map.get(key(dow, h))
      if (!cell) continue
      cell.occurrences += 1
      if (!salesBySlot.has(`${startOfDay(t)}-${h}`)) cell.emptyOccurrences += 1
    }
  }

  const cells = [...map.values()]
  const max = Math.max(1, ...cells.map((c) => c.revenue))
  return { cells, days, hours, max, weeks: Math.round(windowDays / 7) }
}

export interface DeadSlot {
  day: number
  hour: number
  emptyOccurrences: number
  occurrences: number
  revenue: number
}

/** Slots that were empty (no sales) in most of their occurrences, worst first. */
export function deadSlots(heat: HeatmapData, minEmptyRatio = 0.75): DeadSlot[] {
  return heat.cells
    .filter((c) => c.occurrences >= 2 && c.emptyOccurrences / c.occurrences >= minEmptyRatio)
    .map((c) => ({
      day: c.day,
      hour: c.hour,
      emptyOccurrences: c.emptyOccurrences,
      occurrences: c.occurrences,
      revenue: c.revenue,
    }))
    .sort(
      (a, b) =>
        b.emptyOccurrences / b.occurrences - a.emptyOccurrences / a.occurrences || a.revenue - b.revenue,
    )
}

/** Groups consecutive dead hours of the same day into readable phrases. */
export function deadSlotPhrases(slots: DeadSlot[], maxPhrases = 3): string[] {
  const byDay = new Map<number, number[]>()
  for (const s of slots) {
    const list = byDay.get(s.day) ?? []
    list.push(s.hour)
    byDay.set(s.day, list)
  }
  const phrases: { text: string; span: number }[] = []
  for (const [day, hoursRaw] of byDay) {
    const hours = [...hoursRaw].sort((a, b) => a - b)
    let start = hours[0]
    let prev = hours[0]
    const flush = (endHour: number) => {
      const range =
        start === endHour ? `${fmtHour(start)}–${fmtHour(endHour + 1)}` : `${fmtHour(start)}–${fmtHour(endHour + 1)}`
      phrases.push({ text: `${DAY_NAMES[day]} ${range}`, span: endHour - start + 1 })
    }
    for (let i = 1; i < hours.length; i++) {
      if (hours[i] === prev + 1) {
        prev = hours[i]
        continue
      }
      flush(prev)
      start = hours[i]
      prev = hours[i]
    }
    flush(prev)
  }
  return phrases
    .sort((a, b) => b.span - a.span)
    .slice(0, maxPhrases)
    .map((p) => p.text)
}

/** Average revenue per open day of each weekday — surfaces "don't bother opening Mondays". */
export function weekdayAverages(sales: Sale[], opening: OpeningHours, windowDays = 28, now = Date.now()): { day: number; avg: number }[] {
  const from = startOfDay(now) - (windowDays - 1) * DAY_MS
  const totals = new Map<number, number>()
  const counts = new Map<number, number>()
  for (let t = from; t <= now; t += DAY_MS) {
    const dow = new Date(t).getDay()
    if (!opening.openDays.includes(dow)) continue
    counts.set(dow, (counts.get(dow) ?? 0) + 1)
  }
  for (const s of sales) {
    if (s.at < from || s.at > now) continue
    const dow = new Date(s.at).getDay()
    totals.set(dow, (totals.get(dow) ?? 0) + s.total)
  }
  return [...counts.entries()]
    .map(([day, count]) => ({ day, avg: (totals.get(day) ?? 0) / Math.max(1, count) }))
    .sort((a, b) => a.avg - b.avg)
}
