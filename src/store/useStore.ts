import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { idbStorage } from '../lib/idbStorage'
import { remoteStorage } from '../lib/remoteStorage'
import { isLocalMode } from '../lib/mode'
import type { BackupData } from '../lib/backup'
import type {
  AccentKey,
  BusinessSettings,
  Category,
  Decor,
  DecorKind,
  Expense,
  Order,
  OrderItem,
  PayMethod,
  Product,
  Room,
  Sale,
  Table,
  TableShape,
  Widget,
  WidgetType,
} from '../lib/types'
import { buildSeed } from '../lib/seed'
import { uid } from '../lib/format'
import { DEFAULT_TABLE, findFreeSpot, splitBox } from '../lib/floor'
import { migrateState, STORE_VERSION } from '../lib/migrations'
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
  decor: Decor[]
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

  // rooms & tables (floor plan — Épico A)
  addRoom: (name: string) => string
  renameRoom: (id: string, name: string) => void
  deleteRoom: (id: string) => void
  duplicateRoom: (id: string) => string | null
  addTable: (roomId: string, name: string, seats: number) => void
  batchAddTables: (roomId: string, count: number, prefix: string, seats: number, shape: TableShape) => number
  updateTable: (id: string, patch: Partial<Table>) => void
  deleteTable: (id: string) => void
  addDecor: (roomId: string, kind: DecorKind) => string | null
  updateDecor: (id: string, patch: Partial<Decor>) => void
  deleteDecor: (id: string) => void
  /** F2-R30: temporary table beyond the configured layout */
  addExtraTable: (roomId: string, name: string, seats: number) => string | null
  /** F2-R31: split a table into independent sub-tables (reversible) */
  divideTable: (tableId: string, parts: number) => void
  rejoinTable: (parentId: string) => void
  /** F2-R5: move an order to another table, merging bills when occupied */
  transferOrder: (orderId: string, targetTableId: string) => void

  // order flow
  openOrder: (tableId: string | null, employee?: { id: string; name: string }) => string
  setOrderEmployee: (orderId: string, employee: { id: string; name: string } | null) => void
  /** qty: units, or kilograms for weighed products (fractional) */
  addItemToOrder: (orderId: string, product: Product, qty?: number) => void
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
  importData: (data: BackupData) => void
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
      decor: seed.decor,
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

      addRoom: (name) => {
        const id = uid()
        set((s) => ({ rooms: [...s.rooms, { id, name }] }))
        return id
      },
      renameRoom: (id, name) =>
        set((s) => ({ rooms: s.rooms.map((r) => (r.id === id ? { ...r, name } : r)) })),
      deleteRoom: (id) =>
        set((s) => ({
          rooms: s.rooms.filter((r) => r.id !== id),
          tables: s.tables.filter((t) => t.roomId !== id),
          decor: s.decor.filter((d) => d.roomId !== id),
        })),

      // F2-R3: duplicate a room with its full layout (extras/sub-tables excluded)
      duplicateRoom: (id) => {
        const src = get().rooms.find((r) => r.id === id)
        if (!src) return null
        const newId = uid()
        set((s) => ({
          rooms: [...s.rooms, { id: newId, name: `${src.name} (2)` }],
          tables: [
            ...s.tables,
            ...s.tables
              .filter((t) => t.roomId === id && !t.extra && !t.parentTableId)
              .map((t) => ({ ...t, id: uid(), roomId: newId, hidden: false })),
          ],
          decor: [
            ...s.decor,
            ...s.decor.filter((d) => d.roomId === id).map((d) => ({ ...d, id: uid(), roomId: newId })),
          ],
        }))
        return newId
      },

      addTable: (roomId, name, seats) =>
        set((s) => {
          const spot =
            findFreeSpot(roomId, s.tables, s.decor) ??
            findFreeSpot(roomId, s.tables, s.decor, DEFAULT_TABLE.w, DEFAULT_TABLE.h, 200) ?? { x: 0, y: 0 }
          return {
            tables: [
              ...s.tables,
              {
                id: uid(),
                roomId,
                name,
                seats,
                ...spot,
                w: DEFAULT_TABLE.w,
                h: DEFAULT_TABLE.h,
                shape: seats <= 2 ? ('square' as const) : ('rect' as const),
              },
            ],
          }
        }),

      // F2-R3: "add 10 numbered tables" — returns how many actually fitted
      batchAddTables: (roomId, count, prefix, seats, shape) => {
        let created = 0
        set((s) => {
          const tables = [...s.tables]
          const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          let n = 1
          for (const t of tables.filter((t) => t.roomId === roomId)) {
            const m = t.name.match(new RegExp(`^${esc}(\\d+)$`))
            if (m) n = Math.max(n, Number(m[1]) + 1)
          }
          const w = shape === 'round' ? 3 : DEFAULT_TABLE.w
          const h = shape === 'round' ? 3 : DEFAULT_TABLE.h
          for (let i = 0; i < count; i++) {
            const spot =
              findFreeSpot(roomId, tables, s.decor, w, h) ?? findFreeSpot(roomId, tables, s.decor, w, h, 200)
            if (!spot) break
            tables.push({ id: uid(), roomId, name: `${prefix}${n++}`, seats, ...spot, w, h, shape })
            created++
          }
          return { tables }
        })
        return created
      },

      updateTable: (id, patch) =>
        set((s) => ({ tables: s.tables.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTable: (id) =>
        set((s) => ({
          tables: s.tables.filter((t) => t.id !== id && t.parentTableId !== id),
          orders: s.orders.filter((o) => o.tableId !== id),
        })),

      addDecor: (roomId, kind) => {
        const size =
          kind === 'counter' ? { w: 6, h: 2 } : kind === 'wall' ? { w: 6, h: 1 } : kind === 'door' ? { w: 2, h: 1 } : { w: 2, h: 2 }
        const spot = findFreeSpot(roomId, get().tables, get().decor, size.w, size.h)
        if (!spot) return null
        const id = uid()
        set((s) => ({ decor: [...s.decor, { id, roomId, kind, ...spot, ...size }] }))
        return id
      },
      updateDecor: (id, patch) =>
        set((s) => ({ decor: s.decor.map((d) => (d.id === id ? { ...d, ...patch } : d)) })),
      deleteDecor: (id) => set((s) => ({ decor: s.decor.filter((d) => d.id !== id) })),

      // F2-R30: ad-hoc table mid-service; cleaned up when its bill closes
      addExtraTable: (roomId, name, seats) => {
        const s = get()
        const spot =
          findFreeSpot(roomId, s.tables, s.decor, 2, 2) ?? findFreeSpot(roomId, s.tables, s.decor, 2, 2, 200)
        if (!spot) return null
        const id = uid()
        set((st) => ({
          tables: [
            ...st.tables,
            { id, roomId, name, seats, ...spot, w: 2, h: 2, shape: 'square' as const, extra: true },
          ],
        }))
        return id
      },

      // F2-R31: split a table into sub-tables, each with its own bill
      divideTable: (tableId, parts) => {
        const s = get()
        const t = s.tables.find((x) => x.id === tableId)
        if (!t || t.parentTableId || t.hidden) return
        if (t.w < 2) return // Safeguard: must have width >= 2 to be divided
        if (s.orders.some((o) => o.tableId === tableId)) return // occupied tables can't be divided
        const n = Math.max(2, Math.min(4, Math.round(parts)))
        if (n > 2 && t.h < 2) return // Safeguard: 3-way or 4-way splits require height >= 2
        const cells = splitBox(t, n)
        const letters = ['A', 'B', 'C', 'D']
        const seatsEach = Math.max(1, Math.floor(t.seats / n))
        const subs: Table[] = cells.map((box, i) => ({
          id: uid(),
          roomId: t.roomId,
          name: `${t.name}·${letters[i]}`,
          seats: i === n - 1 ? Math.max(1, t.seats - seatsEach * (n - 1)) : seatsEach,
          ...box,
          shape: 'square' as const,
          parentTableId: t.id,
        }))
        set((st) => ({
          tables: [...st.tables.map((x) => (x.id === t.id ? { ...x, hidden: true } : x)), ...subs],
        }))
      },

      rejoinTable: (parentId) => {
        const s = get()
        const subs = s.tables.filter((t) => t.parentTableId === parentId)
        if (subs.length === 0) return
        if (s.orders.some((o) => subs.some((sub) => sub.id === o.tableId))) return // open bills block rejoining
        set((st) => ({
          tables: st.tables
            .filter((t) => t.parentTableId !== parentId)
            .map((t) => (t.id === parentId ? { ...t, hidden: false } : t)),
        }))
      },

      // F2-R5: move a bill to another table; merging when the target is occupied
      transferOrder: (orderId, targetTableId) => {
        const s = get()
        const order = s.orders.find((o) => o.id === orderId)
        const target = s.tables.find((t) => t.id === targetTableId)
        if (!order || !target || target.hidden || order.tableId === targetTableId) return
        const existing = s.orders.find((o) => o.tableId === targetTableId)
        const sourceTable = s.tables.find((t) => t.id === order.tableId)
        set((st) => {
          const orders = existing
            ? st.orders
                .filter((o) => o.id !== orderId)
                .map((o) => (o.id === existing.id ? { ...o, items: [...o.items, ...order.items] } : o))
            : st.orders.map((o) => (o.id === orderId ? { ...o, tableId: targetTableId } : o))
          const tables = sourceTable?.extra ? st.tables.filter((t) => t.id !== sourceTable.id) : st.tables
          return { orders, tables }
        })
      },

      openOrder: (tableId, employee) => {
        const existing = tableId ? get().orders.find((o) => o.tableId === tableId) : undefined
        if (existing) return existing.id
        const id = uid()
        const order: Order = {
          id,
          tableId,
          items: [],
          status: 'open',
          createdAt: Date.now(),
          employeeId: employee?.id,
          employeeName: employee?.name,
        }
        set((s) => ({ orders: [...s.orders, order] }))
        return id
      },

      setOrderEmployee: (orderId, employee) =>
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === orderId
              ? { ...o, employeeId: employee?.id, employeeName: employee?.name }
              : o,
          ),
        })),

      addItemToOrder: (orderId, product, qty = 1) =>
        set((s) => ({
          orders: s.orders.map((o) => {
            if (o.id !== orderId) return o
            if (qty <= 0) return o
            // Unit items without notes merge into one line; weighed items are
            // always their own line (each weighing is a distinct measurement).
            const mergeable =
              product.unit === 'each' ? o.items.find((i) => i.productId === product.id && !i.note) : undefined
            const items = mergeable
              ? o.items.map((i) => (i.id === mergeable.id ? { ...i, qty: i.qty + qty } : i))
              : [
                  ...o.items,
                  {
                    id: uid(),
                    productId: product.id,
                    name: product.name,
                    unitPrice: product.price,
                    qty,
                    unit: product.unit,
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

      cancelOrder: (orderId) => {
        const order = get().orders.find((o) => o.id === orderId)
        set((s) => {
          const table = order ? s.tables.find((t) => t.id === order.tableId) : undefined
          return {
            orders: s.orders.filter((o) => o.id !== orderId),
            // an ad-hoc extra table disappears once its bill is gone (F2-R30)
            tables: table?.extra ? s.tables.filter((t) => t.id !== table.id) : s.tables,
          }
        })
      },

      payOrder: (orderId, method) => {
        const order = get().orders.find((o) => o.id === orderId)
        if (!order || order.items.length === 0) return
        const total = order.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0)
        const sale: Sale = {
          id: uid(),
          at: Date.now(),
          total: Math.round(total * 100) / 100,
          method,
          employeeId: order.employeeId,
          employeeName: order.employeeName,
          lines: order.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            qty: i.qty,
            unitPrice: i.unitPrice,
            unit: i.unit,
          })),
        }
        set((s) => {
          const table = s.tables.find((t) => t.id === order.tableId)
          return {
            sales: [...s.sales, sale],
            orders: s.orders.filter((o) => o.id !== orderId),
            // an ad-hoc extra table disappears once its bill is paid (F2-R30)
            tables: table?.extra ? s.tables.filter((t) => t.id !== table.id) : s.tables,
          }
        })
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
          decor: fresh.decor,
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
          decor: [],
          orders: [],
          sales: [],
          expenses: [],
          widgets: fresh.widgets,
        })
      },

      importData: (data) =>
        set({
          seeded: true,
          orders: [],
          settings: data.settings,
          categories: data.categories,
          products: data.products,
          rooms: data.rooms,
          tables: data.tables,
          decor: data.decor,
          sales: data.sales,
          expenses: data.expenses,
          widgets: data.widgets,
          plan: data.plan,
          trialEndsAt: data.trialEndsAt,
        }),
    }),
    {
      name: 'veronis-store',
      version: STORE_VERSION,
      storage: createJSONStorage(() => (isLocalMode ? idbStorage : remoteStorage)),
      // In server mode, hydration waits for sign-in (AuthGate calls rehydrate).
      skipHydration: !isLocalMode,
      // Schema upgrades live in lib/migrations.ts (pure + unit-tested).
      migrate: (persisted, version) => migrateState(persisted, version) as any,
    },
  ),
)

// Live sync across tabs/windows (e.g. a kitchen display in a second window).
// IndexedDB writes don't emit cross-tab events, so tabs notify each other.
if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
  const channel = new BroadcastChannel('veronis-sync')
  let applyingRemote = false
  let broadcastPending = false

  useStore.subscribe(() => {
    if (applyingRemote || broadcastPending) return
    broadcastPending = true
    // batch rapid changes; give the async persist write time to flush first
    setTimeout(() => {
      broadcastPending = false
      channel.postMessage('sync')
    }, 250)
  })

  channel.onmessage = () => {
    applyingRemote = true
    Promise.resolve(useStore.persist.rehydrate()).finally(() => {
      applyingRemote = false
    })
  }
}
