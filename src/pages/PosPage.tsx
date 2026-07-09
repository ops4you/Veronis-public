import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ChefHat, Minus, Plus, ReceiptText, Scale, ScanBarcode, ShoppingBag, StickyNote, Trash2, Users } from 'lucide-react'
import type { Order, OrderStatus, Product, Table } from '../lib/types'
import { useStore } from '../store/useStore'
import { fmtMoney } from '../lib/format'
import { fmtQty, resolveScan, ScanBuffer } from '../lib/barcode'
import { BillModal } from '../components/pos/BillModal'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../auth/AuthContext'
import { api, type TeamMember } from '../lib/api'
import { isLocalMode } from '../lib/mode'
import { useTranslation } from '../lib/i18n'

const STATUS_STYLE: Record<OrderStatus, { tile: string; chip: string }> = {
  open: { tile: 'border-amber-400 bg-amber-50', chip: 'bg-amber-100 text-amber-800' },
  sent: { tile: 'border-blue-400 bg-blue-50', chip: 'bg-blue-100 text-blue-800' },
  ready: { tile: 'border-green-500 bg-green-50', chip: 'bg-green-100 text-green-800' },
  served: { tile: 'border-violet-400 bg-violet-50', chip: 'bg-violet-100 text-violet-800' },
}

const STATUS_KEY: Record<OrderStatus, string> = {
  open: 'pos.takingOrder',
  sent: 'pos.inKitchen',
  ready: 'pos.readyToServe',
  served: 'pos.awaitingBill',
}

export function PosPage() {
  const { t } = useTranslation()
  const { rooms, tables, orders, settings, openOrder } = useStore()
  const { user } = useAuth()
  const [roomId, setRoomId] = useState<string | null>(null)
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null)
  const me = user ? { id: user.id, name: user.name } : undefined

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
          <h1 className="text-xl font-bold text-stone-900">{t('pos.title')}</h1>
          <p className="text-sm text-stone-500">{t('pos.subtitle')}</p>
        </div>
        <button
          onClick={() => setActiveOrderId(openOrder(null, me))}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <ShoppingBag size={16} /> {t('pos.counterSale')}
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
          {t('pos.noTables')}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {roomTables.map((t) => (
            <TableTile key={t.id} table={t} order={orderFor(t.id)} currency={settings.currency} onOpen={() => setActiveOrderId(openOrder(t.id, me))} />
          ))}
        </div>
      )}

      {counterOrders.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-stone-700">{t('pos.openCounterSales')}</h2>
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
                    <span className="text-lg font-bold text-stone-900">{t('common.counter')}</span>
                    <ShoppingBag size={16} className="text-stone-400" />
                  </div>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${st.chip}`}>{t(STATUS_KEY[o.status])}</span>
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
  const { t } = useTranslation()
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
      {order && st ? (
        <>
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${st.chip}`}>{t(STATUS_KEY[order.status])}</span>
          <div className="mt-1.5 text-xs text-stone-500">
            {order.items.length === 0 ? t('pos.noItems') : fmtMoney(total, currency)}
          </div>
        </>
      ) : (
        <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-500">
          {t('common.free')}
        </span>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------

function OrderView({ order, onBack }: { order: Order; onBack: () => void }) {
  const { t } = useTranslation()
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
    setOrderEmployee,
  } = useStore()
  const [catId, setCatId] = useState<string | null>(null)
  const [billOpen, setBillOpen] = useState(false)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [weighing, setWeighing] = useState<Product | null>(null)
  const [scanMsg, setScanMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const scanMsgTimer = useRef<number | undefined>(undefined)

  const flashScan = (text: string, ok: boolean) => {
    setScanMsg({ text, ok })
    window.clearTimeout(scanMsgTimer.current)
    scanMsgTimer.current = window.setTimeout(() => setScanMsg(null), 2500)
  }

  // USB barcode scanners act as very fast keyboards ending with Enter.
  useEffect(() => {
    const buffer = new ScanBuffer((code) => {
      const res = resolveScan(code, products)
      if (!res) {
        flashScan(t('pos.unknownBarcode', { code }), false)
        return
      }
      if (res.needsWeight) {
        setWeighing(res.product)
        return
      }
      addItemToOrder(order.id, res.product, res.qty)
      flashScan(
        res.product.unit === 'kg'
          ? `${res.product.name} — ${fmtQty(res.qty, 'kg')}`
          : t('pos.addedProduct', { name: res.product.name }),
        true,
      )
    })
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return
      if (buffer.key(e.key)) e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [products, order.id, addItemToOrder, t])

  const table = tables.find((t) => t.id === order.tableId)
  const title = table ? t('bill.table', { name: table.name }) : t('pos.counterSale')
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
            <ArrowLeft size={16} /> {t('common.table') + 's'}
          </button>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold text-stone-900">{title}</h1>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${st.chip}`}>{t(STATUS_KEY[order.status])}</span>
          {!isLocalMode && <ServedByChip order={order} onPick={(emp) => setOrderEmployee(order.id, emp)} />}
          {scanMsg && (
            <span
              role="status"
              className={`ml-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                scanMsg.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              <ScanBarcode size={13} /> {scanMsg.text}
            </span>
          )}
        </header>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setCatId(null)}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
              catId === null ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
            }`}
          >
            {t('pos.categoryAll')}
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
            {t('pos.noProducts')}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 pb-4 sm:grid-cols-3 xl:grid-cols-4">
            {activeProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => (p.unit === 'kg' ? setWeighing(p) : addItemToOrder(order.id, p))}
                className="rounded-xl border border-stone-200 bg-white p-3 text-left shadow-card transition-transform hover:border-brand-500 active:scale-[0.97]"
              >
                <span className="block min-h-[2.4em] text-sm font-medium leading-snug text-stone-900">{p.name}</span>
                <span className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-brand-600">
                  {money(p.price)}
                  {p.unit === 'kg' && (
                    <span className="flex items-center gap-0.5 text-[11px] font-medium text-stone-400">
                      /kg <Scale size={11} />
                    </span>
                  )}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ticket */}
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-stone-200 bg-white shadow-card lg:w-96">
        <div className="border-b border-stone-100 px-4 py-3">
          <h2 className="font-semibold text-stone-900">{t('pos.ticket')}</h2>
        </div>
        <div className="min-h-[8rem] flex-1 overflow-auto px-4">
          {order.items.length === 0 ? (
            <p className="py-10 text-center text-sm text-stone-400">{t('pos.tapProducts')}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {order.items.map((i) => (
                <li key={i.id} className="py-2.5">
                  <div className="flex items-center gap-2">
                    {i.unit === 'kg' ? (
                      <span
                        className="flex items-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs font-semibold text-stone-700"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        <Scale size={12} className="text-stone-400" /> {fmtQty(i.qty, 'kg')}
                      </span>
                    ) : (
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
                    )}
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
                      placeholder={t('pos.notePlaceholder')}
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
            <span className="text-stone-500">{t('pos.total')}</span>
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
              <ChefHat size={16} /> {order.status === 'open' ? t('pos.sendKitchen') : t('pos.updateKitchen')}
            </button>
            <button
              onClick={() => setBillOpen(true)}
              disabled={order.items.length === 0}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ReceiptText size={16} /> {t('pos.charge')}
            </button>
          </div>
          <button
            onClick={() => {
              if (order.items.length === 0 || window.confirm(t('pos.cancelConfirm'))) {
                cancelOrder(order.id)
                onBack()
              }
            }}
            className="w-full rounded-xl px-3 py-2 text-xs font-medium text-stone-400 hover:bg-red-50 hover:text-red-600"
          >
            {t('pos.cancelOrder')}
          </button>
        </div>
      </aside>

      {billOpen && <BillModal order={order} tableName={table?.name ?? null} onClose={() => setBillOpen(false)} onPaid={onBack} />}
      {weighing && (
        <WeightModal
          product={weighing}
          currency={settings.currency}
          onClose={() => setWeighing(null)}
          onConfirm={(kg) => {
            addItemToOrder(order.id, weighing, kg)
            setWeighing(null)
          }}
        />
      )}
    </div>
  )
}

function ServedByChip({
  order,
  onPick,
}: {
  order: Order
  onPick: (emp: { id: string; name: string } | null) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || team !== null) return
    api
      .listUsers()
      .then(({ users }) => setTeam(users))
      .catch(() => setTeam([]))
  }, [open, team])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600 hover:bg-stone-50"
        aria-expanded={open}
      >
        <Users size={12} className="text-stone-400" />
        {order.employeeName ?? t('pos.servedByLabel')}
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-30 w-44 rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
          {team === null ? (
            <p className="px-2 py-1.5 text-xs text-stone-400">{t('pos.loadingTeam')}</p>
          ) : team.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-stone-400">{t('pos.noTeamMembers')}</p>
          ) : (
            team.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onPick({ id: m.id, name: m.name })
                  setOpen(false)
                }}
                className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-stone-100 ${
                  m.id === order.employeeId ? 'font-semibold text-stone-900' : 'text-stone-600'
                }`}
              >
                {m.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function WeightModal({
  product,
  currency,
  onClose,
  onConfirm,
}: {
  product: Product
  currency: string
  onClose: () => void
  onConfirm: (kg: number) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const kg = Number(value.replace(',', '.'))
  const valid = Number.isFinite(kg) && kg > 0 && kg < 1000

  return (
    <Modal title={t('pos.weighProduct', { name: product.name })} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valid) {
            setError(t('pos.weightHint'))
            return
          }
          onConfirm(Math.round(kg * 1000) / 1000)
        }}
        className="space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('pos.weightLabel')}</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder={t('pos.weightPlaceholder')}
            autoFocus
            className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-lg font-semibold focus:border-brand-500 focus:outline-none"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          />
        </label>
        <p className="text-sm text-stone-500">
          {fmtMoney(product.price, currency)}/kg
          {valid && (
            <span className="float-right font-semibold text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
              = {fmtMoney(kg * product.price, currency)}
            </span>
          )}
        </p>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            {t('pos.addToTicket')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
