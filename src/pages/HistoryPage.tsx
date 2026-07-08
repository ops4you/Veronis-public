import { useMemo, useState } from 'react'
import { Banknote, CreditCard, Lock, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Period } from '../lib/types'
import { useStore } from '../store/useStore'
import { periodRange, salesIn, expensesIn, sumSales, sumExpenses } from '../lib/analytics'
import { fmtDateLong, fmtMoney, fmtTime, startOfDay } from '../lib/format'
import { effectivePlan, historyDays } from '../lib/plans'
import { lineText } from '../lib/barcode'

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
]

export function HistoryPage() {
  const [tab, setTab] = useState<'sales' | 'expenses'>('sales')
  const [period, setPeriod] = useState<Period>('7d')
  const { plan, trialEndsAt } = useStore()
  const allowedDays = historyDays(effectivePlan(plan, trialEndsAt))

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">History</h1>
          <p className="text-sm text-stone-500">Every sale and expense, day by day</p>
        </div>
        <div className="flex rounded-xl border border-stone-200 bg-white p-0.5">
          {PERIODS.map((p) => {
            const locked = p.days > allowedDays
            if (locked)
              return (
                <Link
                  key={p.key}
                  to="/plans"
                  title="Longer history is included in the Standard plan"
                  className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-sm font-medium text-stone-300 hover:text-stone-500"
                >
                  <Lock size={12} /> {p.label}
                </Link>
              )
            return (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ${
                  period === p.key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>
      </header>

      <div className="mb-4 flex gap-1.5">
        <button
          onClick={() => setTab('sales')}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === 'sales' ? 'bg-brand-600 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          Sales
        </button>
        <button
          onClick={() => setTab('expenses')}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === 'expenses' ? 'bg-brand-600 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          Expenses
        </button>
      </div>

      {tab === 'sales' ? <SalesLedger period={period} /> : <ExpenseLedger period={period} />}
    </div>
  )
}

function SalesLedger({ period }: { period: Period }) {
  const { sales, settings } = useStore()
  const money = (v: number) => fmtMoney(v, settings.currency)
  const r = periodRange(period)

  const byDay = useMemo(() => {
    const inPeriod = salesIn(sales, r).sort((a, b) => b.at - a.at)
    const groups = new Map<number, typeof inPeriod>()
    for (const s of inPeriod) {
      const day = startOfDay(s.at)
      const list = groups.get(day) ?? []
      list.push(s)
      groups.set(day, list)
    }
    return [...groups.entries()].sort((a, b) => b[0] - a[0])
  }, [sales, r.from, r.to])

  const total = sumSales(salesIn(sales, r))

  if (byDay.length === 0)
    return <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-14 text-center text-sm text-stone-500">No sales in this period.</p>

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-card">
        <span className="text-stone-500">Period total</span>
        <span className="float-right font-bold text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</span>
      </div>
      {byDay.slice(0, 30).map(([day, list]) => (
        <section key={day}>
          <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-sm">
            <span className="font-semibold text-stone-700">{fmtDateLong(day)}</span>
            <span className="text-stone-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {list.length} sales · {money(sumSales(list))}
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
            <ul className="divide-y divide-stone-100">
              {list.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                  <span className="w-12 shrink-0 text-stone-400" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtTime(s.at)}</span>
                  <span className="min-w-0 flex-1 truncate text-stone-600">
                    {s.lines.map((l) => lineText(l.qty, l.unit, l.name)).join(', ')}
                  </span>
                  <span className="shrink-0 text-stone-300" title={s.method === 'cash' ? 'Cash' : 'Card'}>
                    {s.method === 'cash' ? <Banknote size={15} /> : <CreditCard size={15} />}
                  </span>
                  <span className="w-20 shrink-0 text-right font-medium text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {money(s.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ))}
    </div>
  )
}

function ExpenseLedger({ period }: { period: Period }) {
  const { expenses, settings, addExpense, deleteExpense } = useStore()
  const money = (v: number) => fmtMoney(v, settings.currency)
  const r = periodRange(period)
  const inPeriod = expensesIn(expenses, r).sort((a, b) => b.at - a.at)
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('Supplies')

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const parsed = Number(amount.replace(',', '.'))
          if (!label.trim() || !Number.isFinite(parsed) || parsed <= 0) return
          addExpense({ label: label.trim(), amount: Math.round(parsed * 100) / 100, category, at: Date.now() })
          setLabel('')
          setAmount('')
        }}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4 shadow-card"
      >
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">What was it?</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Coffee beans"
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-xs font-medium text-stone-500">Amount</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="45.00"
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="w-36">
          <span className="mb-1 block text-xs font-medium text-stone-500">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {['Supplies', 'Staff', 'Rent', 'Utilities', 'Other'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus size={15} /> Add
        </button>
      </form>

      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-card">
        <span className="text-stone-500">Period total</span>
        <span className="float-right font-bold text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {money(sumExpenses(inPeriod))}
        </span>
      </div>

      {inPeriod.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-14 text-center text-sm text-stone-500">No expenses in this period.</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
          <ul className="divide-y divide-stone-100">
            {inPeriod.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-20 shrink-0 text-stone-400">{fmtDateLong(e.at)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-stone-800">{e.label}</span>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{e.category}</span>
                <span className="w-20 shrink-0 text-right font-medium text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {money(e.amount)}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete expense "${e.label}"?`)) deleteExpense(e.id)
                  }}
                  className="rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete ${e.label}`}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
