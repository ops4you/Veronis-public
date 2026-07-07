import type {
  BusinessSettings,
  Category,
  Expense,
  Product,
  Room,
  Sale,
  SaleLine,
  Table,
  Widget,
} from './types'
import { startOfDay } from './format'

/** Deterministic RNG so the demo data (and its dead-hours story) is stable. */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface SeedData {
  settings: BusinessSettings
  categories: Category[]
  products: Product[]
  rooms: Room[]
  tables: Table[]
  sales: Sale[]
  expenses: Expense[]
  widgets: Widget[]
}

const DAY_MS = 86_400_000

export function buildSeed(now = Date.now()): SeedData {
  const rand = mulberry32(20260707)

  const settings: BusinessSettings = {
    businessName: 'Café Aurora',
    currency: 'EUR',
    opening: { openDays: [0, 1, 2, 3, 4, 5, 6], openHour: 8, closeHour: 20 },
  }

  const categories: Category[] = [
    { id: 'cat-coffee', name: 'Coffee & tea' },
    { id: 'cat-pastry', name: 'Pastries' },
    { id: 'cat-brunch', name: 'Brunch & snacks' },
    { id: 'cat-drinks', name: 'Cold drinks' },
    { id: 'cat-bar', name: 'Bar' },
  ]

  const P = (id: string, name: string, price: number, categoryId: string): Product => ({
    id,
    name,
    price,
    categoryId,
    active: true,
  })

  const products: Product[] = [
    P('p-espresso', 'Espresso', 1.1, 'cat-coffee'),
    P('p-latte', 'Latte', 2.4, 'cat-coffee'),
    P('p-cappuccino', 'Cappuccino', 2.2, 'cat-coffee'),
    P('p-flatwhite', 'Flat white', 2.8, 'cat-coffee'),
    P('p-tea', 'Pot of tea', 2.0, 'cat-coffee'),
    P('p-croissant', 'Butter croissant', 1.6, 'cat-pastry'),
    P('p-natas', 'Pastel de nata', 1.4, 'cat-pastry'),
    P('p-cinnamon', 'Cinnamon roll', 2.6, 'cat-pastry'),
    P('p-cheesecake', 'Cheesecake slice', 3.8, 'cat-pastry'),
    P('p-toast', 'Avocado toast', 6.5, 'cat-brunch'),
    P('p-eggs', 'Scrambled eggs & bread', 7.2, 'cat-brunch'),
    P('p-tosta', 'Tosta mista', 4.2, 'cat-brunch'),
    P('p-soup', 'Soup of the day', 3.9, 'cat-brunch'),
    P('p-oj', 'Fresh orange juice', 3.2, 'cat-drinks'),
    P('p-lemonade', 'House lemonade', 2.9, 'cat-drinks'),
    P('p-soda', 'Soft drink', 1.8, 'cat-drinks'),
    P('p-water', 'Sparkling water', 1.5, 'cat-drinks'),
    P('p-beer', 'Draft beer', 2.5, 'cat-bar'),
    P('p-wine', 'Glass of wine', 3.5, 'cat-bar'),
    P('p-gt', 'Gin & tonic', 6.0, 'cat-bar'),
    P('p-sangria', 'Sangria (glass)', 4.5, 'cat-bar'),
  ]

  const rooms: Room[] = [
    { id: 'room-main', name: 'Main room' },
    { id: 'room-terrace', name: 'Terrace' },
  ]

  const tables: Table[] = []
  for (let i = 1; i <= 8; i++) {
    tables.push({ id: `t-main-${i}`, roomId: 'room-main', name: `T${i}`, seats: i <= 4 ? 2 : 4 })
  }
  for (let i = 1; i <= 6; i++) {
    tables.push({ id: `t-ter-${i}`, roomId: 'room-terrace', name: `E${i}`, seats: 4 })
  }

  // --- Sales history: 84 days with a deliberate quiet-time pattern ----------
  // Mondays are weak overall; 15:00–17:00 is dead early in the week.
  const hourWeight: Record<number, number> = {
    8: 0.9, 9: 1.0, 10: 0.85, 11: 0.6, 12: 1.0, 13: 1.15, 14: 0.7,
    15: 0.18, 16: 0.22, 17: 0.5, 18: 0.75, 19: 0.65,
  }
  const dayWeight = [1.15, 0.22, 0.65, 0.75, 0.9, 1.25, 1.45] // Sun..Sat

  // Hour → likely categories (morning coffee, lunch brunch, evening bar)
  const menusByPhase: Record<string, string[][]> = {
    morning: [
      ['p-espresso'], ['p-latte', 'p-croissant'], ['p-cappuccino', 'p-natas'],
      ['p-flatwhite'], ['p-espresso', 'p-natas'], ['p-tea', 'p-cinnamon'], ['p-oj', 'p-croissant'],
    ],
    lunch: [
      ['p-toast', 'p-oj'], ['p-eggs', 'p-latte'], ['p-tosta', 'p-soda'],
      ['p-soup', 'p-water'], ['p-tosta', 'p-beer'], ['p-toast', 'p-lemonade'], ['p-cheesecake', 'p-espresso'],
    ],
    evening: [
      ['p-beer'], ['p-wine'], ['p-gt'], ['p-sangria', 'p-natas'],
      ['p-beer', 'p-tosta'], ['p-wine', 'p-cheesecake'], ['p-lemonade'],
    ],
  }

  const priceOf = new Map(products.map((p) => [p.id, p.price]))
  const nameOf = new Map(products.map((p) => [p.id, p.name]))

  const sales: Sale[] = []
  const today = startOfDay(now)
  let saleSeq = 0

  for (let back = 84; back >= 0; back--) {
    const dayStart = today - back * DAY_MS
    const dow = new Date(dayStart).getDay()
    const dw = dayWeight[dow]
    for (let h = settings.opening.openHour; h < settings.opening.closeHour; h++) {
      const slotStart = dayStart + h * 3_600_000
      if (slotStart > now) continue
      const hw = hourWeight[h] ?? 0.4
      // Hard dead zones: Monday all afternoon, Tue/Wed 15:00–17:00
      const dead =
        (dow === 1 && h >= 14 && h < 18) || ((dow === 2 || dow === 3) && (h === 15 || h === 16))
      const expected = dead ? 0.04 : 2.4 * hw * dw
      const count = Math.floor(expected + rand() * expected * 0.9 + (rand() < expected % 1 ? 1 : 0))
      for (let i = 0; i < count; i++) {
        const phase = h < 12 ? 'morning' : h < 15 ? 'lunch' : h < 17 ? (rand() < 0.5 ? 'lunch' : 'evening') : 'evening'
        const combos = menusByPhase[phase]
        const combo = combos[Math.floor(rand() * combos.length)]
        const lines: SaleLine[] = combo.map((pid) => ({
          productId: pid,
          name: nameOf.get(pid) ?? pid,
          qty: rand() < 0.22 ? 2 : 1,
          unitPrice: priceOf.get(pid) ?? 0,
        }))
        // occasionally an extra espresso or water on the ticket
        if (rand() < 0.3) {
          const extra = rand() < 0.5 ? 'p-espresso' : 'p-water'
          lines.push({ productId: extra, name: nameOf.get(extra)!, qty: 1, unitPrice: priceOf.get(extra)! })
        }
        const total = lines.reduce((acc, l) => acc + l.qty * l.unitPrice, 0)
        sales.push({
          id: `seed-sale-${saleSeq++}`,
          at: slotStart + Math.floor(rand() * 3_540_000),
          total: Math.round(total * 100) / 100,
          method: rand() < 0.42 ? 'cash' : 'card',
          lines,
        })
      }
    }
  }
  sales.sort((a, b) => a.at - b.at)

  // --- Expenses -------------------------------------------------------------
  const expenses: Expense[] = []
  let expSeq = 0
  const E = (label: string, amount: number, category: string, at: number) =>
    expenses.push({ id: `seed-exp-${expSeq++}`, label, amount, category, at })

  for (let back = 84; back >= 0; back--) {
    const dayStart = today - back * DAY_MS
    const d = new Date(dayStart)
    if (d.getDate() === 1) E('Rent', 950, 'Rent', dayStart + 10 * 3_600_000)
    if (d.getDate() === 28) E('Staff wages', 2350, 'Staff', dayStart + 10 * 3_600_000)
    if (d.getDate() === 5) E('Electricity & water', 128 + Math.round(rand() * 40), 'Utilities', dayStart + 10 * 3_600_000)
    if (d.getDay() === 1) E('Supplier delivery', 140 + Math.round(rand() * 85), 'Supplies', dayStart + 9 * 3_600_000)
  }

  // --- Default dashboard ------------------------------------------------------
  const widgets: Widget[] = [
    { id: 'w-income', type: 'income', size: 1, accent: 'teal' },
    { id: 'w-expenses', type: 'expenses', size: 1, accent: 'red' },
    { id: 'w-profit', type: 'profit', size: 1, accent: 'blue' },
    { id: 'w-orders', type: 'orders', size: 1, accent: 'violet' },
    { id: 'w-salesByDay', type: 'salesByDay', size: 2, accent: 'blue' },
    { id: 'w-deadHours', type: 'deadHours', size: 2, accent: 'amber' },
    { id: 'w-topProducts', type: 'topProducts', size: 2, accent: 'teal' },
    { id: 'w-categoryMix', type: 'categoryMix', size: 1, accent: 'violet' },
    { id: 'w-recentSales', type: 'recentSales', size: 1, accent: 'orange' },
  ]

  return { settings, categories, products, rooms, tables, sales, expenses, widgets }
}
