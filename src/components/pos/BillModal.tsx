import { useState } from 'react'
import { Banknote, CreditCard, Printer } from 'lucide-react'
import type { Order, PayMethod } from '../../lib/types'
import { useStore } from '../../store/useStore'
import { fmtMoney } from '../../lib/format'
import { lineText } from '../../lib/barcode'
import { Modal } from '../ui/Modal'

interface Props {
  order: Order
  tableName: string | null
  onClose: () => void
  /** called after payment is confirmed (navigate back to the table map) */
  onPaid: () => void
}

export function BillModal({ order, tableName, onClose, onPaid }: Props) {
  const { settings, payOrder } = useStore()
  const [method, setMethod] = useState<PayMethod>('card')
  const total = order.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0)
  const money = (v: number) => fmtMoney(v, settings.currency)

  return (
    <Modal title="Bill" onClose={onClose}>
      {/* The receipt — also the print area */}
      <div id="receipt-print" className="rounded-xl border border-stone-200 bg-stone-50 p-4 font-mono text-sm">
        <div className="mb-2 text-center">
          <div className="font-bold">{settings.businessName}</div>
          <div className="text-xs text-stone-500">
            {new Date().toLocaleString()} · {tableName ? `Table ${tableName}` : 'Counter'}
          </div>
        </div>
        <div className="border-t border-dashed border-stone-300 py-2">
          {order.items.map((i) => (
            <div key={i.id} className="flex justify-between gap-2 py-0.5">
              <span className="min-w-0 flex-1 truncate">{lineText(i.qty, i.unit, i.name)}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(i.qty * i.unitPrice)}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-dashed border-stone-300 pt-2 font-bold">
          <span>TOTAL</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</span>
        </div>
        <div className="mt-2 text-center text-xs text-stone-400">Thank you — see you soon!</div>
      </div>

      <fieldset className="mt-4">
        <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-stone-400">Payment method</legend>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMethod('cash')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
              method === 'cash' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
            aria-pressed={method === 'cash'}
          >
            <Banknote size={16} /> Cash
          </button>
          <button
            onClick={() => setMethod('card')}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${
              method === 'card' ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
            aria-pressed={method === 'card'}
          >
            <CreditCard size={16} /> Card
          </button>
        </div>
      </fieldset>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <Printer size={16} /> Print bill
        </button>
        <button
          onClick={() => {
            payOrder(order.id, method)
            onClose()
            onPaid()
          }}
          className="rounded-xl bg-brand-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Confirm {money(total)}
        </button>
      </div>
    </Modal>
  )
}
