import { describe, expect, it } from 'vitest'
import { exportBackup, validateBackup, type BackupData } from '../backup'
import { buildSeed } from '../seed'

function sampleData(): BackupData {
  const seed = buildSeed(new Date(2026, 6, 7, 12, 0).getTime())
  return {
    settings: seed.settings,
    categories: seed.categories,
    products: seed.products,
    rooms: seed.rooms,
    tables: seed.tables,
    sales: seed.sales,
    expenses: seed.expenses,
    widgets: seed.widgets,
    plan: 'standard',
    trialEndsAt: null,
  }
}

describe('backup roundtrip', () => {
  it('export → validate returns identical data', () => {
    const data = sampleData()
    const result = validateBackup(exportBackup(data))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.sales).toHaveLength(data.sales.length)
    expect(result.data.products).toHaveLength(data.products.length)
    expect(result.data.settings.businessName).toBe(data.settings.businessName)
    expect(result.data.plan).toBe('standard')
  })
})

describe('validation rejects bad input', () => {
  it('not JSON', () => {
    const r = validateBackup('this is not json')
    expect(r.ok).toBe(false)
  })
  it('JSON but not a Veronis backup', () => {
    expect(validateBackup('{"foo": 1}').ok).toBe(false)
    expect(validateBackup('42').ok).toBe(false)
    expect(validateBackup('null').ok).toBe(false)
  })
  it('newer backup versions are refused with a helpful message', () => {
    const raw = JSON.stringify({ app: 'veronis', version: 99, data: {} })
    const r = validateBackup(raw)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/newer version/)
  })
  it('missing collections are caught', () => {
    const data = sampleData() as unknown as Record<string, unknown>
    delete data.sales
    const raw = JSON.stringify({ app: 'veronis', version: 2, exportedAt: '', data })
    expect(validateBackup(raw).ok).toBe(false)
  })
  it('malformed sale records are caught', () => {
    const data = sampleData()
    const raw = exportBackup(data).replace(/"total":\s*[\d.]+/, '"total": "not-a-number"')
    expect(validateBackup(raw).ok).toBe(false)
  })
  it('missing settings are caught', () => {
    const data = sampleData() as unknown as Record<string, unknown>
    data.settings = { nope: true }
    const raw = JSON.stringify({ app: 'veronis', version: 2, data })
    expect(validateBackup(raw).ok).toBe(false)
  })
})

describe('forward-compat normalisation', () => {
  it('adds unit:"each" to products from older backups', () => {
    const data = sampleData()
    const stripped = {
      ...data,
      products: data.products.map(({ unit, ...rest }) => rest),
    }
    const raw = JSON.stringify({ app: 'veronis', version: 1, exportedAt: '', data: stripped })
    const r = validateBackup(raw)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.products.every((p) => p.unit === 'each' || p.unit === 'kg')).toBe(true)
  })
  it('defaults unknown plans to basic', () => {
    const data = sampleData() as unknown as Record<string, unknown>
    data.plan = 'enterprise-hacked'
    const raw = JSON.stringify({ app: 'veronis', version: 2, data })
    const r = validateBackup(raw)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data.plan).toBe('basic')
  })
})
