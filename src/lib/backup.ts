import type {
  BusinessSettings,
  Category,
  Decor,
  Expense,
  Product,
  Room,
  Sale,
  Table,
  Widget,
} from './types'
import type { PlanId } from './plans'
import { autoLayoutTables } from './floor'

/**
 * Versioned backup envelope. A backup is the business's safety net — export
 * before anything risky, import to restore or to move to a new machine.
 */

export const BACKUP_VERSION = 3

export interface BackupData {
  settings: BusinessSettings
  categories: Category[]
  products: Product[]
  rooms: Room[]
  tables: Table[]
  decor: Decor[]
  sales: Sale[]
  expenses: Expense[]
  widgets: Widget[]
  plan: PlanId
  trialEndsAt: number | null
}

export interface BackupEnvelope {
  app: 'veronis'
  version: number
  exportedAt: string
  data: BackupData
}

export function exportBackup(data: BackupData): string {
  const envelope: BackupEnvelope = {
    app: 'veronis',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  }
  return JSON.stringify(envelope, null, 2)
}

export type ImportResult = { ok: true; data: BackupData } | { ok: false; error: string }

/** Trigger a browser download of the backup JSON. */
export function downloadBackupFile(data: BackupData): void {
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([exportBackup(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `veronis-backup-${stamp}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

const isArr = Array.isArray
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Structural validation — never trust a file from disk. */
export function validateBackup(raw: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  if (!isObj(parsed)) return { ok: false, error: 'This file is not a Veronis backup.' }
  if (parsed.app !== 'veronis') return { ok: false, error: 'This file is not a Veronis backup.' }
  if (!isFiniteNum(parsed.version) || parsed.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of Veronis — update the app first.' }
  }
  const d = parsed.data
  if (!isObj(d)) return { ok: false, error: 'The backup is missing its data section.' }

  for (const key of ['categories', 'products', 'rooms', 'tables', 'sales', 'expenses', 'widgets'] as const) {
    if (!isArr(d[key])) return { ok: false, error: `The backup is corrupted: "${key}" is missing.` }
  }
  const settings = d.settings
  if (!isObj(settings) || typeof settings.businessName !== 'string' || typeof settings.currency !== 'string') {
    return { ok: false, error: 'The backup is corrupted: business settings are missing.' }
  }
  for (const s of d.sales as unknown[]) {
    if (!isObj(s) || !isFiniteNum(s.at) || !isFiniteNum(s.total) || !isArr(s.lines)) {
      return { ok: false, error: 'The backup is corrupted: a sale record is malformed.' }
    }
  }
  for (const p of d.products as unknown[]) {
    if (!isObj(p) || typeof p.name !== 'string' || !isFiniteNum(p.price)) {
      return { ok: false, error: 'The backup is corrupted: a product record is malformed.' }
    }
  }

  const plan: PlanId = d.plan === 'standard' || d.plan === 'premium' ? d.plan : 'basic'
  const decor: Decor[] = isArr(d.decor) ? (d.decor as Decor[]) : []

  return {
    ok: true,
    data: {
      settings: d.settings as BusinessSettings,
      categories: d.categories as Category[],
      products: (d.products as Product[]).map((p) => ({ ...p, unit: p.unit === 'kg' ? 'kg' : 'each' })),
      rooms: d.rooms as Room[],
      // backups from before the floor plan get an automatic layout (F2-R6)
      tables: autoLayoutTables(d.tables as Table[], decor),
      decor,
      sales: d.sales as Sale[],
      expenses: d.expenses as Expense[],
      widgets: d.widgets as Widget[],
      plan,
      trialEndsAt: isFiniteNum(d.trialEndsAt) ? d.trialEndsAt : null,
    },
  }
}
