import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  effectivePlan,
  historyDays,
  maxRooms,
  maxTables,
  planAllows,
  PLANS,
  trialDaysLeft,
  WIDGET_MIN_PLAN,
} from '../plans'

const NOW = new Date(2026, 6, 7, 12, 0).getTime()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

describe('plan ordering', () => {
  it('higher tiers include lower tiers', () => {
    expect(planAllows('premium', 'basic')).toBe(true)
    expect(planAllows('premium', 'standard')).toBe(true)
    expect(planAllows('standard', 'basic')).toBe(true)
    expect(planAllows('basic', 'standard')).toBe(false)
    expect(planAllows('standard', 'premium')).toBe(false)
  })
})

describe('trial', () => {
  it('an active trial runs the app as premium', () => {
    expect(effectivePlan('basic', NOW + 1000)).toBe('premium')
  })
  it('an expired or absent trial falls back to the paid plan', () => {
    expect(effectivePlan('basic', NOW - 1000)).toBe('basic')
    expect(effectivePlan('standard', null)).toBe('standard')
  })
  it('trialDaysLeft rounds up and never goes negative', () => {
    expect(trialDaysLeft(NOW + 36 * 3600 * 1000)).toBe(2)
    expect(trialDaysLeft(NOW - 1000)).toBe(0)
    expect(trialDaysLeft(null)).toBe(0)
  })
})

describe('limits', () => {
  it('basic is capped, higher tiers are not', () => {
    expect(maxRooms('basic')).toBe(1)
    expect(maxTables('basic')).toBe(10)
    expect(historyDays('basic')).toBe(30)
    expect(maxRooms('standard')).toBe(Infinity)
    expect(maxTables('premium')).toBe(Infinity)
    expect(historyDays('standard')).toBe(Infinity)
  })
})

describe('widget gating', () => {
  it('the quiet-hours differentiator is premium-only', () => {
    expect(WIDGET_MIN_PLAN.deadHours).toBe('premium')
  })
  it('essential tiles stay available on basic', () => {
    for (const t of ['income', 'expenses', 'profit', 'orders', 'avgTicket', 'recentSales'] as const) {
      expect(WIDGET_MIN_PLAN[t]).toBe('basic')
    }
  })
  it('every widget type has a tier assigned', () => {
    expect(Object.values(WIDGET_MIN_PLAN).every((p) => ['basic', 'standard', 'premium'].includes(p))).toBe(true)
  })
})

describe('catalogue sanity', () => {
  it('three tiers, ascending price, annual cheaper than monthly', () => {
    expect(PLANS).toHaveLength(3)
    expect(PLANS[0].monthly).toBeLessThan(PLANS[1].monthly)
    expect(PLANS[1].monthly).toBeLessThan(PLANS[2].monthly)
    for (const p of PLANS) expect(p.annualMonthly).toBeLessThan(p.monthly)
  })
})
