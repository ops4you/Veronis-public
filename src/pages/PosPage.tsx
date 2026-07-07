import { useMemo, useState } from 'react'
import { ArrowLeft, ChefHat, Minus, Plus, ReceiptText, ShoppingBag, StickyNote, Trash2, Users } from 'lucide-react'
import type { Order, OrderStatus, Table } from '../lib/types'
import { useStore } from '../store/useStore'
import { fmtMoney } from '../lib/format'
import { BillModal } from '../components/pos/BillModal'

const STATUS_STYLE: Record<OrderStatus, { label: string; tile: string; chip: string }> = {
  open: { label: 'Taking order', tile: 'border-amber-400 bg-amber-50', chip: 'bg-amber-100 text-amber-800' },
  sent: { label: 'In kitchen', tile: 'border-blue-400 bg-blue-50', chip: 'bg-blue-100 text-blue-800' },
  ready: { label: 'Ready to serve', tile: 'border-green-500 bg-green-50', chip: 'bg-green-100 text-green-800' },
  served: { label: 'Awaiting bill', tile: 'border-violet-400 bg-violet-50', chip: 'bg-violet-100 text-violet-800' },
}

export function PosPage() {
  const { rooms, tables, orders, settings, openOrder } = useStore()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)

  const currentRoomId = roomId ?? rooms[0]?.id ?? null
  const activeOrder = orders.find((o) => o.id === activeOrderId) ?? null

  if (activeOrder) {
    return <OrderView order={activeOrder} onBack={() => setActiveOrderId(null)} />
  }

  const roomTables = tables.filter((t) => t.roomId === currentRoomId)
  const orderFor = (tableId: string) => orders.find((o) => o.tableId === tableId)
  const counterOrders = orders.filter((o) => o.tableId === null)

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">Service</h1>
          <p className="text-sm text-stone-500">Tap a table to take an order</p>
        </div>
        <button
          onClick={() => setActiveOrderId(openOrder(null))}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <ShoppingBag size={16} /> Counter sale
        </button>
      </header>

      {rooms.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => setRoomId(r.id)}
              className={`rounded-xl px-3.5 py-2 text-sm font-medium ${
                r.id === currentRoomId
                  ? 'bg-stone-900 text-white'
                  : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
              }`}
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      {roomTables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-14 text-center text-sm text-stone-500">
          No tables in this room yet — add them in <span className="font-medium">Settings → Rooms &amp; tables</span>.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {roomTables.map((t) => (
            <TableTile key={t.id} table={t} order={orderFor(t.id)} currency={settings.currency} onOpen={() => setActiveOrderId(openOrder(t.id))} />
          ))}
        </div>
      )}

      {counterOrders.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-stone-700">Open counter sales</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {counterOrders.map((o) => {
              const st = STATUS_STYLE[o.status]
              const total = o.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0)
              return (
                <button
                  key={o.id}
                  onClick={() => setActiveOrderId(o.id)}
                  className={`rounded-2xl border-2 p-4 text-left shadow-card transition-transform active:scale-[0.98] ${st.tile}`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-lg font-bold text-stone-900">Counter</span>
                    <ShoppingBag size={16} className="text-stone-400" />
                  </div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${st.chip}`}>{st.label}</span>
                  <div className="mt-1.5 text-xs text-stone-500">{fmtMoney(total, settings.currency)}</div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function TableTile({
  table,
  order,
  currency,
  onOpen,
}: {
  table: Table
  order: Order | undefined
  currency: string
  onOpen: () => void
}) {
  const st = order ? STATUS_STYLE[order.status] : null
  const total = order ? order.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0) : 0
  return (
    <button
      onClick={onOpen}
      className={`rounded-2xl border-2 p-4 text-left shadow-card transition-transform active:scale-[0.98] ${
        st ? st.tile : 'border-stone-200 bg-white hover:border-stone-300'
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="text-lg font-bold text-stone-900">{table.name}</span>
        <span className="flex items-center gap-1 text-xs text-stone-400">
          <Users size={13} /> {table.seats}
        </span>
      </div>
      {st ? (
        <>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${st.chip}`}>{st.label}</span>
          <div className="mt-1.5 text-xs text-stone-500">
            {order!.items.length === 0 ? 'No items yet' : fmtMoney(total, currency)}
          </div>
        </>
      ) : (
        <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
          Free
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------

function OrderView({ order, onBack }: { order: Order; onBack: () => void }) {
  const {
    categories,
    products,
    tables,
    settings,
    addItemToOrder,
    setItemQty,
    setItemNote,
    removeItem,
    sendToKitchen,
    cancelOrder,
  } = useStore()
  const [catId, setCatId] = useState<string | null>(null)
  const [billOpen, setBillOpen] = useState(false)
  const [noteFor, setNoteFor] = useState<string | null>(null)

  const table = tables.find((t) => t.id === order.tableId)
  const title = table ? `Table ${table.name}` : 'Counter sale'
  const st = STATUS_STYLE[order.status]
  const total = order.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0)
  const money = (v: number) => fmtMoney(v, settings.currency)

  const activeProducts = useMemo(
    () => products.filter((p) => p.active && (catId === null || p.categoryId === catId)),
    [products, catId],
  )

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:h-[calc(100vh-4rem)] lg:flex-row">
      {/* Product picker */}
      <div className="min-w-0 flex-1">
        <header className="mb-4 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
          >
            <ArrowLeft size={16} /> Tables
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-stone-900">{title}</h1>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${st.chip}`}>{st.label}</span>
        </header>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCatId(null)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
              catId === null ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCatId(c.id)}
              className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                catId === c.id ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {activeProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-sm text-stone-500">
            No products here yet — add them in the <span className="font-medium">Menu</span> page.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pb-4 sm:grid-cols-3 xl:grid-cols-4">
            {activeProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => addItemToOrder(order.id, p)}
                className="rounded-xl border border-stone-200 bg-white p-3 text-left shadow-card transition-transform hover:border-brand-500 active:scale-[0.97]"
              >
                <span className="block min-h-[2.4em] text-sm font-medium leading-snug text-stone-900">{p.name}</span>
                <span className="mt-1 block text-sm font-semibold text-brand-600">{money(p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticket */}
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-stone-200 bg-white shadow-card lg:w-96">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-semibold text-stone-900">Ticket</h2>
        </div>
        <div className="min-h-[8rem] flex-1 overflow-auto px-4">
          {order.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">Tap products to add them</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {order.items.map((i) => (
                <li key={i.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-stone-200">
                      <button
                        onClick={() => setItemQty(order.id, i.id, i.qty - 1)}
                        className="p-1.5 text-stone-500 hover:text-stone-900"
                        aria-label={`One less ${i.name}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {i.qty}
                      </span>
                      <button
                        onClick={() => setItemQty(order.id, i.id, i.qty + 1)}
                        className="p-1.5 text-stone-500 hover:text-stone-900"
                        aria-label={`One more ${i.name}`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm text-stone-800">{i.name}</span>
                    <span className="text-sm font-medium text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {money(i.qty * i.unitPrice)}
                    </span>
                    <button
                      onClick={() => setNoteFor(noteFor === i.id ? null : i.id)}
                      className={`rounded-md p-1 ${i.note ? 'text-brand-600' : 'text-stone-300 hover:text-stone-600'}`}
                      aria-label={`Note for ${i.name}`}
                    >
                      <StickyNote size={14} />
                    </button>
                    <button
                      onClick={() => removeItem(order.id, i.id)}
                      className="rounded-md p-1 text-stone-300 hover:text-red-600"
                      aria-label={`Remove ${i.name}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {(noteFor === i.id || i.note) && (
                    <input
                      value={i.note ?? ''}
                      onChange={(e) => setItemNote(order.id, i.id, e.target.value)}
                      placeholder="Note for the kitchen (e.g. no sugar)"
                      className="mt-1.5 w-full rounded-lg border border-stone-200 px-2.5 py-1.5 text-xs focus:border-brand-500 focus:outline-none"
                    />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2.5 border-t border-stone-100 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Total</span>
            <span className="text-xl font-bold text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {money(total)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => sendToKitchen(order.id)}
              disabled={order.items.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChefHat size={16} /> {order.status === 'open' ? 'Send to kitchen' : 'Update kitchen'}
            </button>
            <button
              onClick={() => setBillOpen(true)}
              disabled={order.items.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ReceiptText size={16} /> Charge
            </button>
          </div>
          <button
            onClick={() => {
              if (order.items.length === 0 || window.confirm('Cancel this order? Its items will be discarded.')) {
                cancelOrder(order.id)
                onBack()
              }
            }}
            className="w-full rounded-xl px-3 py-2 text-xs font-medium text-stone-400 hover:bg-red-50 hover:text-red-600"
          >
            Cancel order
          </button>
        </div>
      </aside>

      {billOpen && <BillModal order={order} tableName={table?.name ?? null} onClose={() => setBillOpen(false)} onPaid={onBack} />}
    </div>
  )
}
