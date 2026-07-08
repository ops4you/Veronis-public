import { useState } from 'react'
import { Lock, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Period, WidgetType } from '../lib/types'
import { useStore } from '../store/useStore'
import { WidgetCard } from '../components/widgets/WidgetCard'
import { WIDGET_META, WidgetBody, widgetSubtitle } from '../components/widgets/registry'
import { Modal } from '../components/ui/Modal'
import { accent } from '../lib/palette'
import { WIDGET_MIN_PLAN, effectivePlan, planAllows, planName } from '../lib/plans'
import { useAuth } from '../auth/AuthContext'
import { BarChart } from '../components/charts/BarChart'
import { avgTicket, dailyTotals, hourlyTotals, periodRange, salesIn, sumSales } from '../lib/analytics'
import { fmtMoney, fmtNumber } from '../lib/format'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
]

export function DashboardPage() {
  const { user, isAdmin } = useAuth()
  if (!isAdmin && user) return <EmployeeDashboard userId={user.id} userName={user.name} />
  return <AdminDashboard />
}

function AdminDashboard() {
  const { widgets, settings, addWidget, plan, trialEndsAt } = useStore()
  const [period, setPeriod] = useState<Period>('7d')
  const [adding, setAdding] = useState(false)
  const navigate = useNavigate()
  const currentPlan = effectivePlan(plan, trialEndsAt)

  const available = (Object.keys(WIDGET_META) as WidgetType[]).filter(
    (t) => !widgets.some((w) => w.type === t),
  )

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">{settings.businessName}</h1>
          <p className="text-sm text-stone-500">How the business is doing, at a glance</p>
        </div>
        <div className="flex rounded-xl border border-stone-200 bg-white p-0.5" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p.key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <Plus size={16} /> Add widget
        </button>
      </header>

      {widgets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-14 text-center">
          <p className="mb-1 font-medium text-stone-700">Your dashboard is empty</p>
          <p className="mb-4 text-sm text-stone-500">Add the numbers you care about — each box is a widget you can colour, resize and reorder.</p>
          <button
            onClick={() => setAdding(true)}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add your first widget
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {widgets.map((w) => {
            const meta = WIDGET_META[w.type]
            return (
              <WidgetCard
                key={w.id}
                widget={w}
                title={meta.title}
                subtitle={widgetSubtitle(w.type, period)}
                icon={meta.icon}
                tall={meta.chart}
              >
                <WidgetBody widget={w} period={period} />
              </WidgetCard>
            )
          })}
        </div>
      )}

      {adding && (
        <AddWidgetModal available={available} currentPlan={currentPlan} onClose={() => setAdding(false)} onAdd={(t) => addWidget(t)} navigate={navigate} />
      )}
    </div>
  )
}

function EmployeeDashboard({ userId, userName }: { userId: string; userName: string }) {
  const { sales, settings } = useStore()
  const [period, setPeriod] = useState<Period>('7d')
  const mySales = sales.filter((s) => s.employeeId === userId)
  const r = periodRange(period)
  const inPeriod = salesIn(mySales, r)
  const money = (v: number) => fmtMoney(v, settings.currency)
  const points = period === 'today' ? hourlyTotals(inPeriod, r) : dailyTotals(inPeriod, r)

  const cards = [
    { label: 'My sales', value: money(sumSales(inPeriod)) },
    { label: 'Orders served', value: fmtNumber(inPeriod.length) },
    { label: 'Average ticket', value: money(avgTicket(inPeriod)) },
  ]

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">My sales</h1>
          <p className="text-sm text-stone-500">Nice work, {userName} — here is what you sold</p>
        </div>
        <div className="flex rounded-xl border border-stone-200 bg-white p-0.5" role="tablist" aria-label="Period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={`rounded-[10px] px-3 py-1.5 text-sm font-medium ${
                period === p.key ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-stone-200/80 bg-surface p-4 shadow-card">
            <p className="text-sm font-medium text-stone-500">{c.label}</p>
            <p className="mt-1 text-[1.7rem] font-semibold leading-none text-stone-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-200/80 bg-surface p-4 shadow-card">
        <h2 className="mb-2 text-sm font-semibold text-stone-900">My sales over time</h2>
        <div className="h-52">
          <BarChart
            data={points.map((p) => ({ label: p.label, value: Math.round(p.total * 100) / 100 }))}
            color="#2a78d6"
            formatValue={money}
            height={200}
          />
        </div>
      </div>
    </div>
  )
}

function AddWidgetModal({
  available,
  currentPlan,
  onClose,
  onAdd,
  navigate,
}: {
  available: WidgetType[]
  currentPlan: ReturnType<typeof effectivePlan>
  onClose: () => void
  onAdd: (t: WidgetType) => void
  navigate: ReturnType<typeof useNavigate>
}) {
  return (
        <Modal title="Add a widget" onClose={onClose} wide>
          {available.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-500">Every widget is already on your dashboard.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {available.map((type) => {
                const meta = WIDGET_META[type]
                const a = accent('blue')
                const Icon = meta.icon
                const required = WIDGET_MIN_PLAN[type]
                const locked = !planAllows(currentPlan, required)
                return (
                  <button
                    key={type}
                    onClick={() => {
                      if (locked) {
                        onClose()
                        navigate('/plans')
                        return
                      }
                      onAdd(type)
                      onClose()
                    }}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left ${
                      locked
                        ? 'border-stone-200 bg-stone-50/60 hover:border-stone-300'
                        : 'border-stone-200 hover:border-brand-500 hover:bg-brand-50/40'
                    }`}
                  >
                    <span
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: a.tint, color: locked ? '#a8a29e' : a.color }}
                    >
                      {locked ? <Lock size={15} /> : <Icon size={16} />}
                    </span>
                    <span>
                      <span className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                        {meta.title}
                        {locked && (
                          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700">
                            {planName(required)}
                          </span>
                        )}
                      </span>
                      <span className="block text-xs leading-snug text-stone-500">{meta.description}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </Modal>
  )
}
