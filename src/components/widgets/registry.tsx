import {
  BarChart3,
  Coins,
  CreditCard,
  History,
  Moon,
  PieChart,
  PiggyBank,
  Receipt,
  ShoppingBag,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Period, Widget, WidgetType } from '../../lib/types'
import {
  avgTicket,
  categoryMix,
  dailyTotals,
  deadSlotPhrases,
  deadSlots,
  downsample,
  expensesIn,
  hourHeatmap,
  hourlyTotals,
  paymentMix,
  pctChange,
  salesByEmployee,
  periodLabel,
  periodRange,
  prevPeriodLabel,
  previousRange,
  salesIn,
  sumExpenses,
  sumSales,
  topProducts,
  weekdayAverages,
} from '../../lib/analytics'
import { DAY_NAMES, fmtMoney, fmtMoneyCompact, fmtNumber, fmtTime, fmtDate } from '../../lib/format'
import { accent } from '../../lib/palette'
import { WIDGET_MIN_PLAN, effectivePlan, planAllows } from '../../lib/plans'
import { lineText } from '../../lib/barcode'
import { useStore } from '../../store/useStore'
import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatTile } from './StatTile'
import { BarChart } from '../charts/BarChart'
import { HBarChart } from '../charts/HBarChart'
import { Donut } from '../charts/Donut'
import { Heatmap } from '../charts/Heatmap'
import { useTranslation, i18n } from '../../lib/i18n'

export interface WidgetMeta {
  title: string
  icon: LucideIcon
  description: string
  chart: boolean
}

export const WIDGET_META: Record<WidgetType, WidgetMeta> = {
  income: { title: 'Income', icon: Coins, description: 'Money in, with trend vs the previous period', chart: false },
  expenses: { title: 'Expenses', icon: Receipt, description: 'Money out, with trend vs the previous period', chart: false },
  profit: { title: 'Profit', icon: PiggyBank, description: 'Income minus expenses', chart: false },
  orders: { title: 'Orders', icon: ShoppingBag, description: 'Number of paid orders', chart: false },
  avgTicket: { title: 'Average ticket', icon: CreditCard, description: 'Average spend per order', chart: false },
  salesByDay: { title: 'Sales', icon: BarChart3, description: 'Revenue per day (or per hour today)', chart: true },
  topProducts: { title: 'Top products', icon: Star, description: 'Best sellers by revenue', chart: true },
  categoryMix: { title: 'Category mix', icon: PieChart, description: 'Revenue share by menu category', chart: false },
  paymentMix: { title: 'Payments', icon: CreditCard, description: 'Cash vs card split', chart: false },
  deadHours: { title: 'Quiet hours', icon: Moon, description: 'Hours and days with no clients — when you could close or run a lighter shift', chart: true },
  recentSales: { title: 'Latest sales', icon: History, description: 'The most recent paid orders', chart: false },
  salesByEmployee: { title: 'Sales by employee', icon: Users, description: 'Who sold how much — revenue and orders per team member', chart: true },
}

export function widgetSubtitle(type: WidgetType, period: Period): string {
  if (type === 'deadHours') return i18n.t('widgets.subtitle.deadHours')
  if (type === 'recentSales') return i18n.t('widgets.subtitle.recentSales')
  return periodLabel(period)
}

export function WidgetBody({ widget, period }: { widget: Widget; period: Period }) {
  const { t, lang } = useTranslation()
  const { sales, expenses, products, categories, settings, plan, trialEndsAt } = useStore()
  const a = accent(widget.accent)

  const getPlanName = (id: string) => {
    if (id === 'basic') return lang === 'pt' ? 'Básico' : 'Basic'
    if (id === 'standard') return 'Standard'
    if (id === 'premium') return 'Premium'
    return id
  }

  const required = WIDGET_MIN_PLAN[widget.type]
  if (!planAllows(effectivePlan(plan, trialEndsAt), required)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <Lock size={18} className="text-stone-300" />
        <p className="text-sm text-stone-500">
          {t('widgets.locked', { plan: getPlanName(required) })}
        </p>
        <Link to="/plans" className="text-sm font-medium text-brand-600 hover:underline">
          {t('widgets.seePlans')}
        </Link>
      </div>
    )
  }
  const cur = settings.currency
  const r = periodRange(period)
  const prev = previousRange(r)
  const inPeriod = salesIn(sales, r)
  const inPrev = salesIn(sales, prev)
  const money = (v: number) => fmtMoney(v, cur)
  const moneyC = (v: number) => fmtMoneyCompact(v, cur)

  const trendOf = (items: { at: number; total: number }[]) => {
    const pts = period === 'today' ? hourlyTotals(items, r) : dailyTotals(items, r)
    return downsample(pts.map((p) => p.total))
  }

  switch (widget.type) {
    case 'income': {
      const now = sumSales(inPeriod)
      const before = sumSales(inPrev)
      return (
        <StatTile
          value={moneyC(now)}
          deltaPct={pctChange(now, before)}
          deltaLabel={prevPeriodLabel(period)}
          upIsGood
          trend={trendOf(inPeriod)}
          accentColor={a.color}
        />
      )
    }
    case 'expenses': {
      const items = expensesIn(expenses, r).map((e) => ({ at: e.at, total: e.amount }))
      const before = sumExpenses(expensesIn(expenses, prev))
      const now = items.reduce((acc, i) => acc + i.total, 0)
      return (
        <StatTile
          value={moneyC(now)}
          deltaPct={pctChange(now, before)}
          deltaLabel={prevPeriodLabel(period)}
          upIsGood={false}
          trend={trendOf(items)}
          accentColor={a.color}
        />
      )
    }
    case 'profit': {
      const now = sumSales(inPeriod) - sumExpenses(expensesIn(expenses, r))
      const before = sumSales(inPrev) - sumExpenses(expensesIn(expenses, prev))
      const salesDaily = period === 'today' ? hourlyTotals(inPeriod, r) : dailyTotals(inPeriod, r)
      const expDaily =
        period === 'today'
          ? hourlyTotals(expensesIn(expenses, r).map((e) => ({ at: e.at, total: e.amount })), r)
          : dailyTotals(expensesIn(expenses, r).map((e) => ({ at: e.at, total: e.amount })), r)
      const trend = downsample(salesDaily.map((p, i) => p.total - (expDaily[i]?.total ?? 0)))
      return (
        <StatTile
          value={moneyC(now)}
          deltaPct={before > 0 ? pctChange(now, before) : null}
          deltaLabel={prevPeriodLabel(period)}
          upIsGood
          trend={trend}
          accentColor={a.color}
        />
      )
    }
    case 'orders': {
      const counts = inPeriod.map((s) => ({ at: s.at, total: 1 }))
      return (
        <StatTile
          value={fmtNumber(inPeriod.length)}
          deltaPct={pctChange(inPeriod.length, inPrev.length)}
          deltaLabel={prevPeriodLabel(period)}
          upIsGood
          trend={trendOf(counts)}
          accentColor={a.color}
        />
      )
    }
    case 'avgTicket': {
      const now = avgTicket(inPeriod)
      const before = avgTicket(inPrev)
      const sums = period === 'today' ? hourlyTotals(inPeriod, r) : dailyTotals(inPeriod, r)
      const cnts =
        period === 'today'
          ? hourlyTotals(inPeriod.map((s) => ({ at: s.at, total: 1 })), r)
          : dailyTotals(inPeriod.map((s) => ({ at: s.at, total: 1 })), r)
      const trend = downsample(sums.map((p, i) => (cnts[i]?.total ? p.total / cnts[i].total : 0)))
      return (
        <StatTile
          value={money(now)}
          deltaPct={pctChange(now, before)}
          deltaLabel={prevPeriodLabel(period)}
          upIsGood
          trend={trend}
          accentColor={a.color}
        />
      )
    }
    case 'salesByDay': {
      const pts = period === 'today' ? hourlyTotals(inPeriod, r) : dailyTotals(inPeriod, r)
      const cnts =
        period === 'today'
          ? hourlyTotals(inPeriod.map((s) => ({ at: s.at, total: 1 })), r)
          : dailyTotals(inPeriod.map((s) => ({ at: s.at, total: 1 })), r)
      return (
        <BarChart
          data={pts.map((p, i) => ({
            label: p.label,
            value: Math.round(p.total * 100) / 100,
            sub: t('widgets.ordersCount', { count: cnts[i]?.total ?? 0 }),
          }))}
          color={a.color}
          formatValue={money}
          height={200}
        />
      )
    }
    case 'topProducts': {
      const top = topProducts(inPeriod, 6)
      return (
        <HBarChart
          data={top.map((t) => ({ name: t.name, value: t.revenue, sub: `· ${t.qty}×` }))}
          color={a.color}
          formatValue={moneyC}
        />
      )
    }
    case 'salesByEmployee': {
      const byEmployee = salesByEmployee(inPeriod).slice(0, 6)
      return (
        <HBarChart
          data={byEmployee.map((e) => ({ name: e.name, value: e.revenue, sub: `· ${t('widgets.ordersCount', { count: e.orders })}` }))}
          color={a.color}
          formatValue={moneyC}
        />
      )
    }
    case 'categoryMix': {
      return <Donut slices={categoryMix(inPeriod, products, categories)} formatValue={moneyC} />
    }
    case 'paymentMix': {
      const mix = paymentMix(inPeriod)
      const total = mix.cash + mix.card
      const cashPct = total > 0 ? (mix.cash / total) * 100 : 50
      return (
        <div className="flex h-full flex-col justify-center gap-3">
          {total === 0 ? (
            <p className="text-center text-sm text-stone-400">{t('widgets.noSalesPeriod')}</p>
          ) : (
            <>
              <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded-md">
                <div style={{ width: `${cashPct}%`, background: a.color }} />
                <div className="flex-1" style={{ background: a.tint }} />
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />
                  <span className="text-stone-600">{t('widgets.cash')}</span>
                  <span className="ml-auto font-medium text-stone-900">{money(mix.cash)}</span>
                  <span className="w-9 text-right text-stone-400">{cashPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm border border-stone-300" style={{ background: a.tint }} />
                  <span className="text-stone-600">{t('widgets.card')}</span>
                  <span className="ml-auto font-medium text-stone-900">{money(mix.card)}</span>
                  <span className="w-9 text-right text-stone-400">{(100 - cashPct).toFixed(0)}%</span>
                </div>
              </div>
            </>
          )}
        </div>
      )
    }
    case 'deadHours': {
      const heat = hourHeatmap(sales, settings.opening, 28)
      const phrases = deadSlotPhrases(deadSlots(heat))
      const byDay = weekdayAverages(sales, settings.opening, 28)
      const weakest = byDay[0]
      const strongest = byDay[byDay.length - 1]
      const weakDayNote =
        weakest && strongest && strongest.avg > 0 && weakest.avg < strongest.avg * 0.4
          ? t('widgets.weakDayNote', {
              weakDay: DAY_NAMES[weakest.day],
              weakAvg: fmtMoneyCompact(weakest.avg, cur),
              strongDay: DAY_NAMES[strongest.day],
              strongAvg: fmtMoneyCompact(strongest.avg, cur),
            })
          : null
      return (
        <div className="flex h-full flex-col gap-3">
          <div className="flex-1">
            <Heatmap heat={heat} formatValue={money} />
          </div>
          {(phrases.length > 0 || weakDayNote) && (
            <div className="rounded-xl px-3 py-2.5 text-xs leading-relaxed text-stone-700" style={{ background: a.tint }}>
              {phrases.length > 0 && (
                <p>
                  <span className="font-semibold">{t('widgets.usuallyEmpty')}</span> {phrases.join(' · ')} —{' '}
                  {t('widgets.considerLighter')}
                </p>
              )}
              {weakDayNote && <p className={phrases.length > 0 ? 'mt-1' : ''}>{weakDayNote}</p>}
            </div>
          )}
        </div>
      )
    }
    case 'recentSales': {
      const recent = [...sales].sort((x, y) => y.at - x.at).slice(0, 7)
      if (recent.length === 0)
        return <p className="flex h-full items-center justify-center text-sm text-stone-400">{t('widgets.noSalesYet')}</p>
      return (
        <ul className="divide-y divide-stone-100">
          {recent.map((s) => (
            <li key={s.id} className="flex items-center gap-2 py-1.5 text-xs">
              <span className="w-20 shrink-0 text-stone-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {fmtDate(s.at)} {fmtTime(s.at)}
              </span>
              <span className="min-w-0 flex-1 truncate text-stone-600">
                {s.lines.map((l) => lineText(l.qty, l.unit, l.name)).join(', ')}
              </span>
              <span className="shrink-0 font-medium text-stone-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {money(s.total)}
              </span>
            </li>
          ))}
        </ul>
      )
    }
  }
}
