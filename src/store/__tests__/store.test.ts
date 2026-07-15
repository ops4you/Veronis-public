import { beforeEach, describe, expect, it } from 'vitest'
import { useStore } from '../useStore'
import type { Product } from '../../lib/types'

// The store persists via IndexedDB in the browser; in tests the storage
// adapter falls back to an in-memory Map, so state changes are synchronous
// enough to assert directly through getState().

const S = () => useStore.getState()

const espresso = (): Product => S().products.find((p) => p.id === 'p-espresso')!
const fruit = (): Product => S().products.find((p) => p.unit === 'kg')!

beforeEach(() => {
  S().seedDemo()
})

describe('order lifecycle', () => {
  it('openOrder creates one order per table and reuses it', () => {
    const a = S().openOrder('t-main-1')
    const b = S().openOrder('t-main-1')
    expect(a).toBe(b)
    expect(S().orders).toHaveLength(1)
  })

  it('counter orders are always new', () => {
    const a = S().openOrder(null)
    const b = S().openOrder(null)
    expect(a).not.toBe(b)
  })

  it('adding the same unit product merges lines; notes split them', () => {
    const id = S().openOrder('t-main-2')
    S().addItemToOrder(id, espresso())
    S().addItemToOrder(id, espresso())
    let order = S().orders.find((o) => o.id === id)!
    expect(order.items).toHaveLength(1)
    expect(order.items[0].qty).toBe(2)

    S().setItemNote(id, order.items[0].id, 'no sugar')
    S().addItemToOrder(id, espresso())
    order = S().orders.find((o) => o.id === id)!
    expect(order.items).toHaveLength(2)
  })

  it('weighed products always get their own line with fractional qty', () => {
    const id = S().openOrder('t-main-3')
    S().addItemToOrder(id, fruit(), 0.485)
    S().addItemToOrder(id, fruit(), 0.31)
    const order = S().orders.find((o) => o.id === id)!
    expect(order.items).toHaveLength(2)
    expect(order.items[0].qty).toBeCloseTo(0.485)
    expect(order.items[0].unit).toBe('kg')
  })

  it('rejects non-positive quantities', () => {
    const id = S().openOrder('t-main-4')
    S().addItemToOrder(id, espresso(), 0)
    S().addItemToOrder(id, espresso(), -3)
    expect(S().orders.find((o) => o.id === id)!.items).toHaveLength(0)
  })

  it('setItemQty at zero removes the line', () => {
    const id = S().openOrder('t-main-5')
    S().addItemToOrder(id, espresso())
    const item = S().orders.find((o) => o.id === id)!.items[0]
    S().setItemQty(id, item.id, 0)
    expect(S().orders.find((o) => o.id === id)!.items).toHaveLength(0)
  })

  it('sendToKitchen requires items and stamps sentAt', () => {
    const id = S().openOrder('t-main-6')
    S().sendToKitchen(id)
    expect(S().orders.find((o) => o.id === id)!.status).toBe('open')

    S().addItemToOrder(id, espresso())
    S().sendToKitchen(id)
    const order = S().orders.find((o) => o.id === id)!
    expect(order.status).toBe('sent')
    expect(order.sentAt).toBeTypeOf('number')
  })

  it('payOrder records an exact sale, frees the table, and removes the order', () => {
    const before = S().sales.length
    const id = S().openOrder('t-main-7')
    S().addItemToOrder(id, espresso(), 2) // 2 × 1.10
    S().addItemToOrder(id, fruit(), 0.5) // 0.5 × 8.90
    S().payOrder(id, 'cash')

    expect(S().orders.find((o) => o.id === id)).toBeUndefined()
    expect(S().sales).toHaveLength(before + 1)
    const sale = S().sales[S().sales.length - 1]
    expect(sale.total).toBeCloseTo(2 * 1.1 + 0.5 * 8.9, 2)
    expect(sale.method).toBe('cash')
    expect(sale.lines).toHaveLength(2)
    expect(sale.lines[1].unit).toBe('kg')
  })

  it('paying an empty order does nothing', () => {
    const before = S().sales.length
    const id = S().openOrder('t-main-8')
    S().payOrder(id, 'card')
    expect(S().sales).toHaveLength(before)
    expect(S().orders.find((o) => o.id === id)).toBeDefined()
  })

  it('cancelOrder discards the order', () => {
    const id = S().openOrder('t-main-1')
    S().addItemToOrder(id, espresso())
    S().cancelOrder(id)
    expect(S().orders.find((o) => o.id === id)).toBeUndefined()
  })

  it('attributes the sale to the employee who served the order', () => {
    const id = S().openOrder('t-main-1', { id: 'emp-9', name: 'Rita' })
    S().addItemToOrder(id, espresso())
    S().payOrder(id, 'card')
    const last = S().sales[S().sales.length - 1]
    expect(last.employeeId).toBe('emp-9')
    expect(last.employeeName).toBe('Rita')
  })

  it('setOrderEmployee reassigns who is serving', () => {
    const id = S().openOrder('t-main-2', { id: 'emp-9', name: 'Rita' })
    S().setOrderEmployee(id, { id: 'emp-4', name: 'Tiago' })
    S().addItemToOrder(id, espresso())
    S().payOrder(id, 'cash')
    const last = S().sales[S().sales.length - 1]
    expect(last.employeeName).toBe('Tiago')
  })
})

describe('menu and floor management', () => {
  it('deleting a category deletes its products', () => {
    const catCount = S().categories.length
    S().deleteCategory('cat-coffee')
    expect(S().categories).toHaveLength(catCount - 1)
    expect(S().products.some((p) => p.categoryId === 'cat-coffee')).toBe(false)
  })

  it('deleting a room deletes its tables', () => {
    S().deleteRoom('room-terrace')
    expect(S().tables.some((t) => t.roomId === 'room-terrace')).toBe(false)
  })

  it('deleting a table drops its open order', () => {
    const id = S().openOrder('t-main-1')
    S().deleteTable('t-main-1')
    expect(S().orders.find((o) => o.id === id)).toBeUndefined()
  })
})

describe('dashboard widgets', () => {
  it('addWidget is idempotent per type', () => {
    S().removeWidget(S().widgets.find((w) => w.type === 'paymentMix')?.id ?? '')
    const n = S().widgets.length
    S().addWidget('paymentMix')
    S().addWidget('paymentMix')
    expect(S().widgets).toHaveLength(n + 1)
  })

  it('moveWidget reorders and clamps at the edges', () => {
    const first = S().widgets[0]
    S().moveWidget(first.id, -1) // already first — no-op
    expect(S().widgets[0].id).toBe(first.id)
    S().moveWidget(first.id, 1)
    expect(S().widgets[1].id).toBe(first.id)
  })
})

describe('subscription state', () => {
  it('choosing a plan ends the trial', () => {
    expect(S().trialEndsAt).not.toBeNull()
    S().setPlan('standard')
    expect(S().plan).toBe('standard')
    expect(S().trialEndsAt).toBeNull()
  })
})

describe('import / reset', () => {
  it('importData replaces business data and clears open orders', () => {
    S().openOrder('t-main-1')
    const snapshot = {
      settings: { ...S().settings, businessName: 'Restored Café' },
      categories: S().categories,
      products: S().products,
      rooms: S().rooms,
      tables: S().tables,
      decor: S().decor,
      sales: S().sales.slice(0, 5),
      expenses: [],
      widgets: S().widgets,
      plan: 'premium' as const,
      trialEndsAt: null,
    }
    S().importData(snapshot)
    expect(S().settings.businessName).toBe('Restored Café')
    expect(S().sales).toHaveLength(5)
    expect(S().orders).toHaveLength(0)
    expect(S().plan).toBe('premium')
  })

  it('clearAllData empties the business but keeps the app usable', () => {
    S().clearAllData()
    expect(S().sales).toHaveLength(0)
    expect(S().products).toHaveLength(0)
    expect(S().rooms).toHaveLength(1)
    expect(S().widgets.length).toBeGreaterThan(0)
  })
})
