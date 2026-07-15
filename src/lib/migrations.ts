import { autoLayoutTables } from './floor'

/**
 * Store schema migrations (F2-R6: never lose data on upgrade).
 * Pure function so it can be unit-tested outside the zustand persist config.
 *
 * v1 → v2  products/order items gained `unit`; licensing fields became mandatory
 * v2 → v3  floor plan: tables gained x/y/w/h/shape; `decor` collection added
 */
export const STORE_VERSION = 3

const TRIAL_DAYS = 14

export function migrateState(persisted: unknown, version: number): unknown {
  const s = persisted as Record<string, any>
  if (!s) return persisted

  if (version < 2) {
    s.products = (s.products ?? []).map((p: any) => ({ unit: 'each', ...p }))
    s.orders = (s.orders ?? []).map((o: any) => ({
      ...o,
      items: (o.items ?? []).map((i: any) => ({ unit: 'each', ...i })),
    }))
    s.plan = s.plan ?? 'basic'
    s.trialEndsAt = s.trialEndsAt ?? Date.now() + TRIAL_DAYS * 86_400_000
  }

  if (version < 3) {
    s.decor = s.decor ?? []
    s.tables = autoLayoutTables(s.tables ?? [], s.decor)
  }

  return s
}
