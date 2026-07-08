import type { WidgetType } from './types'

export type PlanId = 'basic' | 'standard' | 'premium'

export interface PlanMeta {
  id: PlanId
  name: string
  tagline: string
  /** €/month, VAT excl. */
  monthly: number
  /** €/month billed annually */
  annualMonthly: number
  features: string[]
  highlight?: boolean
}

export const PLANS: PlanMeta[] = [
  {
    id: 'basic',
    name: 'Basic',
    tagline: 'For a small counter or kiosk',
    monthly: 14.9,
    annualMonthly: 11.9,
    features: [
      'Orders, kitchen screen & bills',
      '1 room · up to 10 tables',
      'Menu & price management',
      'Essential dashboard widgets',
      '30 days of history',
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    tagline: 'For most cafés, pastry shops & bars',
    monthly: 29.9,
    annualMonthly: 23.9,
    highlight: true,
    features: [
      'Everything in Basic',
      'Unlimited rooms & tables',
      'All chart widgets (sales, top products, mix…)',
      'Full history & expense ledger',
      'Email support',
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    tagline: 'Know exactly when to open and staff',
    monthly: 49.9,
    annualMonthly: 39.9,
    features: [
      'Everything in Standard',
      'Quiet-hours intelligence & staffing hints',
      'Priority support',
      'Early access to new features',
      'Coming soon: multi-device sync, staff roles, exports',
    ],
  },
]

export const PLAN_RANK: Record<PlanId, number> = { basic: 0, standard: 1, premium: 2 }

export function planAllows(current: PlanId, required: PlanId): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required]
}

/** Trial runs the app as Premium until it expires. */
export function effectivePlan(plan: PlanId, trialEndsAt: number | null): PlanId {
  return trialEndsAt !== null && Date.now() < trialEndsAt ? 'premium' : plan
}

export function trialDaysLeft(trialEndsAt: number | null): number {
  if (trialEndsAt === null) return 0
  return Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86_400_000))
}

/** Lowest plan that includes each dashboard widget. */
export const WIDGET_MIN_PLAN: Record<WidgetType, PlanId> = {
  income: 'basic',
  expenses: 'basic',
  profit: 'basic',
  orders: 'basic',
  avgTicket: 'basic',
  recentSales: 'basic',
  salesByDay: 'standard',
  topProducts: 'standard',
  categoryMix: 'standard',
  paymentMix: 'standard',
  salesByEmployee: 'standard',
  deadHours: 'premium',
}

export function maxRooms(plan: PlanId): number {
  return plan === 'basic' ? 1 : Number.POSITIVE_INFINITY
}

export function maxTables(plan: PlanId): number {
  return plan === 'basic' ? 10 : Number.POSITIVE_INFINITY
}

/** How far back History may look. */
export function historyDays(plan: PlanId): number {
  return plan === 'basic' ? 30 : Number.POSITIVE_INFINITY
}

export function planName(id: PlanId): string {
  return PLANS.find((p) => p.id === id)?.name ?? id
}
