import { describe, expect, it } from 'vitest'
import {
  autoLayoutTables,
  boxesOverlap,
  canPlace,
  findFreeSpot,
  GRID_H,
  GRID_W,
  splitBox,
} from '../floor'
import { migrateState } from '../migrations'
import type { Decor, Table } from '../types'

const T = (over: Partial<Table>): Table => ({
  id: over.id ?? `t-${Math.random()}`,
  roomId: 'r1',
  name: 'T',
  seats: 4,
  x: 0,
  y: 0,
  w: 3,
  h: 2,
  shape: 'square',
  ...over,
})

describe('boxesOverlap / canPlace', () => {
  it('detects overlaps and touching-but-not-overlapping boxes', () => {
    expect(boxesOverlap({ x: 0, y: 0, w: 3, h: 2 }, { x: 2, y: 1, w: 2, h: 2 })).toBe(true)
    expect(boxesOverlap({ x: 0, y: 0, w: 3, h: 2 }, { x: 3, y: 0, w: 2, h: 2 })).toBe(false)
    expect(boxesOverlap({ x: 0, y: 0, w: 3, h: 2 }, { x: 0, y: 2, w: 3, h: 2 })).toBe(false)
  })

  it('rejects out-of-bounds placements', () => {
    expect(canPlace({ x: -1, y: 0, w: 2, h: 2 }, 'r1', [], [])).toBe(false)
    expect(canPlace({ x: GRID_W - 1, y: 0, w: 2, h: 2 }, 'r1', [], [])).toBe(false)
    expect(canPlace({ x: 0, y: GRID_H - 1, w: 2, h: 2 }, 'r1', [], [])).toBe(false)
    expect(canPlace({ x: 0, y: 0, w: 2, h: 2 }, 'r1', [], [])).toBe(true)
  })

  it('rejects collisions with tables and decor, ignores hidden tables and self', () => {
    const tables = [T({ id: 'a', x: 0, y: 0 }), T({ id: 'hidden', x: 5, y: 5, hidden: true })]
    const decor: Decor[] = [{ id: 'd', roomId: 'r1', kind: 'counter', x: 10, y: 0, w: 6, h: 2 }]
    expect(canPlace({ x: 1, y: 1, w: 2, h: 2 }, 'r1', tables, decor)).toBe(false)
    expect(canPlace({ x: 11, y: 0, w: 2, h: 2 }, 'r1', tables, decor)).toBe(false)
    expect(canPlace({ x: 5, y: 5, w: 2, h: 2 }, 'r1', tables, decor)).toBe(true) // hidden parent ignored
    expect(canPlace({ x: 0, y: 0, w: 3, h: 2 }, 'r1', tables, decor, 'a')).toBe(true) // moving itself
    expect(canPlace({ x: 1, y: 1, w: 2, h: 2 }, 'r2', tables, decor)).toBe(true) // other room
  })
})

describe('findFreeSpot', () => {
  it('finds the first gap and avoids occupied space', () => {
    const tables = [T({ id: 'a', x: 0, y: 0, w: GRID_W, h: 2 })] // full first rows
    const spot = findFreeSpot('r1', tables, [])
    expect(spot).toEqual({ x: 0, y: 2 })
  })

  it('returns null when the room is completely full', () => {
    const tables = [T({ id: 'a', x: 0, y: 0, w: GRID_W, h: GRID_H })]
    expect(findFreeSpot('r1', tables, [])).toBeNull()
  })
})

describe('splitBox (F2-R31)', () => {
  it('splits into 2 side-by-side halves inside the parent', () => {
    const parts = splitBox({ x: 4, y: 6, w: 4, h: 2 }, 2)
    expect(parts).toEqual([
      { x: 4, y: 6, w: 2, h: 2 },
      { x: 6, y: 6, w: 2, h: 2 },
    ])
  })

  it('splits into quadrants for 3–4 parts and never escapes the footprint', () => {
    const parent = { x: 2, y: 2, w: 3, h: 2 }
    for (const n of [3, 4]) {
      const parts = splitBox(parent, n)
      expect(parts).toHaveLength(n)
      for (const p of parts) {
        expect(p.x).toBeGreaterThanOrEqual(parent.x)
        expect(p.y).toBeGreaterThanOrEqual(parent.y)
        expect(p.x + p.w).toBeLessThanOrEqual(parent.x + parent.w)
        expect(p.y + p.h).toBeLessThanOrEqual(parent.y + parent.h)
        expect(p.w).toBeGreaterThanOrEqual(1)
        expect(p.h).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

describe('autoLayoutTables (F2-R6)', () => {
  it('lays out legacy tables without overlaps and preserves everything else', () => {
    const legacy = [
      { id: 'a', roomId: 'r1', name: 'T1', seats: 2 },
      { id: 'b', roomId: 'r1', name: 'T2', seats: 4 },
      { id: 'c', roomId: 'r2', name: 'E1', seats: 4 },
    ] as unknown as Table[]
    const laid = autoLayoutTables(legacy)
    expect(laid).toHaveLength(3)
    for (const t of laid) {
      expect(t.w).toBeGreaterThan(0)
      expect(t.h).toBeGreaterThan(0)
      expect(typeof t.x).toBe('number')
      expect(['square', 'round', 'rect']).toContain(t.shape)
    }
    // same-room tables must not overlap
    const [a, b] = laid
    expect(boxesOverlap(a, b)).toBe(false)
    expect(laid.map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('leaves tables that already have a layout untouched', () => {
    const positioned = T({ id: 'keep', x: 7, y: 7, w: 4, h: 4, shape: 'round' })
    const laid = autoLayoutTables([positioned])
    expect(laid[0]).toMatchObject({ x: 7, y: 7, w: 4, h: 4, shape: 'round' })
  })
})

describe('migrateState v2 → v3 (SCRUM-17)', () => {
  const v2 = () => ({
    plan: 'standard',
    trialEndsAt: null,
    products: [{ id: 'p', name: 'Latte', price: 2.4, categoryId: 'c', active: true, unit: 'each' }],
    orders: [],
    tables: [
      { id: 't1', roomId: 'r1', name: 'T1', seats: 2 },
      { id: 't2', roomId: 'r1', name: 'T2', seats: 4 },
    ],
    rooms: [{ id: 'r1', name: 'Sala' }],
    sales: [{ id: 's', at: 1, total: 2.4, method: 'card', lines: [] }],
  })

  it('adds layout to tables and a decor collection, losing nothing', () => {
    const out = migrateState(v2(), 2) as any
    expect(out.decor).toEqual([])
    expect(out.tables).toHaveLength(2)
    for (const t of out.tables) {
      expect(typeof t.x).toBe('number')
      expect(t.w).toBeGreaterThan(0)
      expect(t.shape).toBeDefined()
      expect(t.seats).toBeGreaterThan(0) // original data preserved
    }
    expect(boxesOverlap(out.tables[0], out.tables[1])).toBe(false)
    expect(out.sales).toHaveLength(1)
    expect(out.plan).toBe('standard')
  })

  it('runs the full chain from v1', () => {
    const v1 = v2() as any
    delete v1.plan
    delete v1.trialEndsAt
    v1.products = [{ id: 'p', name: 'Latte', price: 2.4, categoryId: 'c', active: true }]
    const out = migrateState(v1, 1) as any
    expect(out.products[0].unit).toBe('each')
    expect(out.plan).toBe('basic')
    expect(out.tables[0].w).toBeGreaterThan(0)
    expect(out.decor).toEqual([])
  })

  it('is a no-op at the current version', () => {
    const state = { tables: [T({ id: 'x', x: 3, y: 3 })], decor: [{ id: 'd' }] }
    const out = migrateState(state, 3) as any
    expect(out.tables[0].x).toBe(3)
    expect(out.decor).toHaveLength(1)
  })
})
