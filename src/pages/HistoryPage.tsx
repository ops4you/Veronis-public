import { useMemo, useState } from 'react'
import { Banknote, CreditCard, Lock, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Period } from '../lib/types'
import { useStore } from '../store/useStore'
import { periodRange, salesIn, expensesIn, sumSales, sumExpenses } from '../lib/analytics'
import { fmtDateLong, fmtMoney, fmtTime, startOfDay } from '../lib/format'
import { effectivePlan, historyDays } from '../lib/plans'
import { lineText } from '../lib/barcode'
import { useTranslation } from '../lib/i18n'

const PERIODS: { key: Period; daysKey: 'today' | 'days7' | 'days30' | 'days90'; days: number }[] = [
  { key: 'today', daysKey: 'today', days: 1 },
  { key: '7d', daysKey: 'days7', days: 7 },
  { key: '30d', daysKey: 'days30', days: 30 },
  { key: '90d', daysKey: 'days90', days: 90 },
]

const EXPENSE_CATEGORIES = ['Supplies', 'Staff', 'Rent', 'Utilities', 'Other']
const CATEGORY_KEYS: Record<string, string> = {
  Supplies: 'history.expenseCategorySupplies',
  Staff: 'history.expenseCategoryStaff',
  Rent: 'history.expenseCategoryRent',
  Utilities: 'history.expenseCategoryUtilities',
  Other: 'history.expenseCategoryOther',
}

export function HistoryPage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'sales' | 'expenses'>('sales')
  const [period, setPeriod] = useState<Period>('7d')
  const { plan, trialEndsAt } = useStore()
  const allowedDays = historyDays(effectivePlan(plan, trialEndsAt))

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">{t('history.title')}</h1>
          <p className="text-sm text-stone-500">{t('history.subtitle')}</p>
        </div>
        <div className="flex rounded-xl border border-stone-200 bg-white p-0.5">
          {PERIODS.map((p) => {
            const locked = p.days > allowedDays
            if (locked)
              return (
                <Link
                  key={p.key}
                  to="/plans"
                  title={t('history.lockedHint')}
                  className="flex items-center gap-1 rounded-[10px] px-3 py-1.5 text-sm font-medium text-stone-300 hover:text-stone-500"
                >
                  <Lock size={12} /> {t(`common.${p.daysKey}`)}
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
                {t(`common.${p.daysKey}`)}
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
          {t('history.sales')}
        </button>
        <button
          onClick={() => setTab('expenses')}
          className={`rounded-xl px-4 py-2 text-sm font-medium ${
            tab === 'expenses' ? 'bg-brand-600 text-white' : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-100'
          }`}
        >
          {t('history.expenses')}
        </button>
      </div>

      {tab === 'sales' ? <SalesLedger period={period} /> : <ExpenseLedger period={period} />}
    </div>
  )
}

function SalesLedger({ period }: { period: Period }) {
  const { t } = useTranslation()
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
    return <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-14 text-center text-sm text-stone-500">{t('history.noSales')}</p>

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-card">
        <span className="text-stone-500">{t('history.periodTotal')}</span>
        <span className="float-right font-bold text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{money(total)}</span>
      </div>
      {byDay.slice(0, 30).map(([day, list]) => (
        <section key={day}>
          <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-sm">
            <span className="font-semibold text-stone-700">{fmtDateLong(day)}</span>
            <span className="text-stone-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('history.salesCount', { count: list.length, total: money(sumSales(list)) })}
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
                  <span className="shrink-0 text-stone-300" title={s.method === 'cash' ? t('bill.cash') : t('bill.card')}>
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
  const { t } = useTranslation()
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
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('history.whatWasIt')}</span>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('history.whatWasItPlaceholder')}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="w-28">
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('history.amount')}</span>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder={t('history.amountPlaceholder')}
            className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label className="w-36">
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('history.expenseCategory')}</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(CATEGORY_KEYS[c])}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus size={15} /> {t('common.add')}
        </button>
      </form>

      <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm shadow-card">
        <span className="text-stone-500">{t('history.periodTotal')}</span>
        <span className="float-right font-bold text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {money(sumExpenses(inPeriod))}
        </span>
      </div>

      {inPeriod.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-14 text-center text-sm text-stone-500">{t('history.noExpenses')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
          <ul className="divide-y divide-stone-100">
            {inPeriod.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                <span className="w-20 shrink-0 text-stone-400">{fmtDateLong(e.at)}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-stone-800">{e.label}</span>
                <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">{t(CATEGORY_KEYS[e.category] ?? 'history.expenseCategoryOther')}</span>
                <span className="w-20 shrink-0 text-right font-medium text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {money(e.amount)}
                </span>
                <button
                  onClick={() => {
                    if (window.confirm(t('history.deleteExpenseConfirm', { name: e.label }))) deleteExpense(e.id)
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
