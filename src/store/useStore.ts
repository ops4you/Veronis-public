import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AccentKey,
  BusinessSettings,
  Category,
  Expense,
  Order,
  OrderItem,
  PayMethod,
  Product,
  Room,
  Sale,
  Table,
  Widget,
  WidgetType,
} from '../lib/types'
import { buildSeed } from '../lib/seed'
import { uid } from '../lib/format'
import type { PlanId } from '../lib/plans'

const TRIAL_DAYS = 14

interface State {
  seeded: boolean
  /** paid tier; a running trial upgrades the effective plan to premium */
  plan: PlanId
  trialEndsAt: number | null
  settings: BusinessSettings
  categories: Category[]
  products: Product[]
  rooms: Room[]
  tables: Table[]
  orders: Order[] // active (unpaid) orders only
  sales: Sale[]
  expenses: Expense[]
  widgets: Widget[]

  // subscription (demo licensing — a real deployment validates server-side)
  setPlan: (plan: PlanId) => void

  // settings
  updateSettings: (patch: Partial<BusinessSettings>) => void

  // menu
  addCategory: (name: string) => void
  renameCategory: (id: string, name: string) => void
  deleteCategory: (id: string) => void
  addProduct: (p: Omit<Product, 'id'>) => void
  updateProduct: (id: string, patch: Partial<Product>) => void
  deleteProduct: (id: string) => void

  // rooms & tables
  addRoom: (name: string) => void
  renameRoom: (id: string, name: string) => void
  deleteRoom: (id: string) => void
  addTable: (roomId: string, name: string, seats: number) => void
  updateTable: (id: string, patch: Partial<Table>) => void
  deleteTable: (id: string) => void

  // order flow
  openOrder: (tableId: string | null) => string
  addItemToOrder: (orderId: string, product: Product) => void
  setItemQty: (orderId: string, itemId: string, qty: number) => void
  setItemNote: (orderId: string, itemId: string, note: string) => void
  removeItem: (orderId: string, itemId: string) => void
  sendToKitchen: (orderId: string) => void
  markReady: (orderId: string) => void
  markServed: (orderId: string) => void
  cancelOrder: (orderId: string) => void
  payOrder: (orderId: string, method: PayMethod) => void

  // expenses
  addExpense: (e: Omit<Expense, 'id'>) => void
  deleteExpense: (id: string) => void

  // dashboard widgets
  addWidget: (type: WidgetType) => void
  removeWidget: (id: string) => void
  moveWidget: (id: string, dir: -1 | 1) => void
  setWidgetAccent: (id: string, accent: AccentKey) => void
  setWidgetSize: (id: string, size: 1 | 2) => void

  // data management
  seedDemo: () => void
  clearAllData: () => void
}

const seed = buildSeed()

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      seeded: true,
      plan: 'basic',
      trialEndsAt: Date.now() + TRIAL_DAYS * 86_400_000,
      settings: seed.settings,
      categories: seed.categories,
      products: seed.products,
      rooms: seed.rooms,
      tables: seed.tables,
      orders: [],
      sales: seed.sales,
      expenses: seed.expenses,
      widgets: seed.widgets,

      setPlan: (plan) => set({ plan, trialEndsAt: null }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addCategory: (name) =>
        set((s) => ({ categories: [...s.categories, { id: uid(), name }] })),
      renameCategory: (id, name) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)) })),
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          products: s.products.filter((p) => p.categoryId !== id),
        })),

      addProduct: (p) => set((s) => ({ products: [...s.products, { ...p, id: uid() }] })),
      updateProduct: (id, patch) =>
        set((s) => ({ products: s.products.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      deleteProduct: (id) => set((s) => ({ products: s.products.filter((p) => p.id !== id) })),

      addRoom: (name) => set((s) => ({ rooms: [...s.rooms, { id: uid(), name }] })),
      renameRoom: (id, name) =>
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, name } : r)) })),
      deleteRoom: (id) =>
        set((s) => ({
          rooms: s.rooms.filter((r) => r.id !== id),
          tables: s.tables.filter((t) => t.roomId !== id),
        })),
      addTable: (roomId, name, seats) =>
        set((s) => ({ tables: [...s.tables, { id: uid(), roomId, name, seats }] })),
      updateTable: (id, patch) =>
        set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTable: (id) =>
        set((s) => ({
          tables: s.tables.filter((t) => t.id !== id),
          orders: s.orders.filter((o) => o.tableId !== id),
        })),

      openOrder: (tableId) => {
        const existing = tableId ? get().orders.find((o) => o.tableId === tableId) : undefined
        if (existing) return existing.id
        const id = uid()
        const order: Order = { id, tableId, items: [], status: 'open', createdAt: Date.now() }
        set((s) => ({ orders: [...s.orders, order] }))
        return id
      },

      addItemToOrder: (orderId, product) =>
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o
            const existing = o.items.find((i) => i.productId === product.id && !i.note)
            const items = existing
              ? o.items.map((i) => (i.id === existing.id ? { ...i, qty: i.qty + 1 } : i))
              : [
                  ...o.items,
                  {
                    id: uid(),
                    productId: product.id,
                    name: product.name,
                    unitPrice: product.price,
                    qty: 1,
                  } as OrderItem,
                ]
            return { ...o, items }
          }),
        })),

      setItemQty: (orderId, itemId, qty) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  items:
                    qty <= 0
                      ? o.items.filter((i) => i.id !== itemId)
                      : o.items.map((i) => (i.id === itemId ? { ...i, qty } : i)),
                }
              : o,
          ),
        })),

      setItemNote: (orderId, itemId, note) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, items: o.items.map((i) => (i.id === itemId ? { ...i, note } : i)) }
              : o,
          ),
        })),

      removeItem: (orderId, itemId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, items: o.items.filter((i) => i.id !== itemId) } : o,
          ),
        })),

      sendToKitchen: (orderId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId && o.items.length > 0 ? { ...o, status: 'sent', sentAt: Date.now() } : o,
          ),
        })),

      markReady: (orderId) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId ? { ...o, status: 'ready', readyAt: Date.now() } : o,
          ),
        })),

      markServed: (orderId) =>
        set((s) => ({
          orders: s.orders.map((o) => (o.id === orderId ? { ...o, status: 'served' } : o)),
        })),

      cancelOrder: (orderId) =>
        set((s) => ({ orders: s.orders.filter((o) => o.id !== orderId) })),

      payOrder: (orderId, method) => {
        const order = get().orders.find((o) => o.id === orderId)
        if (!order || order.items.length === 0) return
        const total = order.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0)
        const sale: Sale = {
          id: uid(),
          at: Date.now(),
          total: Math.round(total * 100) / 100,
          method,
          lines: order.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            qty: i.qty,
            unitPrice: i.unitPrice,
          })),
        }
        set((s) => ({
          sales: [...s.sales, sale],
          orders: s.orders.filter((o) => o.id !== orderId),
        }))
      },

      addExpense: (e) => set((s) => ({ expenses: [...s.expenses, { ...e, id: uid() }] })),
      deleteExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      addWidget: (type) =>
        set((s) => {
          if (s.widgets.some((w) => w.type === type)) return s
          const chart = ['salesByDay', 'topProducts', 'deadHours'].includes(type)
          return {
            widgets: [...s.widgets, { id: uid(), type, size: chart ? 2 : 1, accent: 'blue' }],
          }
        }),
      removeWidget: (id) => set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id) })),
      moveWidget: (id, dir) =>
        set((s) => {
          const idx = s.widgets.findIndex((w) => w.id === id)
          const to = idx + dir
          if (idx < 0 || to < 0 || to >= s.widgets.length) return s
          const widgets = [...s.widgets]
          const [w] = widgets.splice(idx, 1)
          widgets.splice(to, 0, w)
          return { widgets }
        }),
      setWidgetAccent: (id, accentKey) =>
        set((s) => ({
          widgets: s.widgets.map((w) => (w.id === id ? { ...w, accent: accentKey } : w)),
        })),
      setWidgetSize: (id, size) =>
        set((s) => ({ widgets: s.widgets.map((w) => (w.id === id ? { ...w, size } : w)) })),

      seedDemo: () => {
        const fresh = buildSeed()
        set({
          seeded: true,
          plan: 'basic',
          trialEndsAt: Date.now() + TRIAL_DAYS * 86_400_000,
          settings: fresh.settings,
          categories: fresh.categories,
          products: fresh.products,
          rooms: fresh.rooms,
          tables: fresh.tables,
          orders: [],
          sales: fresh.sales,
          expenses: fresh.expenses,
          widgets: fresh.widgets,
        })
      },

      clearAllData: () => {
        const fresh = buildSeed()
        set({
          seeded: false,
          settings: { ...fresh.settings, businessName: 'My business' },
          categories: [],
          products: [],
          rooms: [{ id: uid(), name: 'Main room' }],
          tables: [],
          orders: [],
          sales: [],
          expenses: [],
          widgets: fresh.widgets,
        })
      },
    }),
    { name: 'veronis-store', version: 1 },
  ),
)

// Live sync across browser tabs (e.g. a kitchen display in a second window):
// when another tab writes the store, rehydrate this one.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'veronis-store') void useStore.persist.rehydrate()
  })
}
