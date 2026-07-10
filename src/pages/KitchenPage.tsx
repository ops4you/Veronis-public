import { useEffect, useState, type ReactNode } from 'react'
import { Check, ChefHat, ConciergeBell } from 'lucide-react'
import type { Order } from '../lib/types'
import { useStore } from '../store/useStore'
import { fmtElapsed } from '../lib/format'
import { lineText } from '../lib/barcode'
import { useTranslation } from '../lib/i18n'

function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

export function KitchenPage() {
  const { t } = useTranslation()
  const { orders, tables, markReady, markServed } = useStore()
  const now = useNow()

  const sent = orders.filter((o) => o.status === 'sent').sort((a, b) => (a.sentAt ?? 0) - (b.sentAt ?? 0))
  const ready = orders.filter((o) => o.status === 'ready').sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0))

  const tableName = (o: Order) =>
    o.tableId === null ? t('bill.counter') : t('bill.table', { name: tables.find((t) => t.id === o.tableId)?.name ?? '?' })

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5">
        <h1 className="text-xl font-bold text-stone-900">{t('kitchen.title')}</h1>
        <p className="text-sm text-stone-500">
          {t('kitchen.subtitle')}
        </p>
      </header>

      {sent.length === 0 && ready.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-16 text-center">
          <ChefHat className="mx-auto mb-3 text-stone-300" size={40} />
          <p className="font-medium text-stone-600">{t('kitchen.allQuiet')}</p>
          <p className="text-sm text-stone-400">{t('kitchen.newTickets')}</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-label={t('kitchen.inPreparation')}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> {t('kitchen.inPreparation')} ({sent.length})
            </h2>
            <div className="space-y-3">
              {sent.map((o) => (
                <TicketCard
                  key={o.id}
                  title={tableName(o)}
                  order={o}
                  elapsed={fmtElapsed(now - (o.sentAt ?? o.createdAt))}
                  actionLabel={t('kitchen.markReady')}
                  actionIcon={<Check size={15} />}
                  onAction={() => markReady(o.id)}
                />
              ))}
              {sent.length === 0 && <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">{t('kitchen.nothingPrep')}</p>}
            </div>
          </section>
          <section aria-label={t('kitchen.readyToServe')}>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-stone-700">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> {t('kitchen.readyToServe')} ({ready.length})
            </h2>
            <div className="space-y-3">
              {ready.map((o) => (
                <TicketCard
                  key={o.id}
                  title={tableName(o)}
                  order={o}
                  elapsed={fmtElapsed(now - (o.readyAt ?? o.createdAt))}
                  actionLabel={t('kitchen.served')}
                  actionIcon={<ConciergeBell size={15} />}
                  onAction={() => markServed(o.id)}
                  ready
                />
              ))}
              {ready.length === 0 && <p className="rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-400">{t('kitchen.nothingWaiting')}</p>}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function TicketCard({
  title,
  order,
  elapsed,
  actionLabel,
  actionIcon,
  onAction,
  ready,
}: {
  title: string
  order: Order
  elapsed: string
  actionLabel: string
  actionIcon: ReactNode
  onAction: () => void
  ready?: boolean
}) {
  return (
    <article className={`rounded-2xl border-2 bg-white p-4 shadow-card ${ready ? 'border-green-400' : 'border-blue-300'}`}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-bold text-stone-900">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ready ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {elapsed}
        </span>
      </div>
      <ul className="mb-3 space-y-1">
        {order.items.map((i) => (
          <li key={i.id} className="text-sm text-stone-800">
            <span className="font-semibold">{lineText(i.qty, i.unit, i.name)}</span>
            {i.note && <span className="ml-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">{i.note}</span>}
          </li>
        ))}
      </ul>
      <button
        onClick={onAction}
        className={`flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-white ${
          ready ? 'bg-green-600 hover:bg-green-700' : 'bg-stone-900 hover:bg-stone-800'
        }`}
      >
        {actionIcon} {actionLabel}
      </button>
    </article>
  )
}
