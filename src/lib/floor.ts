import type { Decor, Table } from './types'

/**
 * Floor-plan geometry (Épico A). Rooms are a grid of cells; tables and decor
 * occupy rectangular boxes of cells. Everything here is pure and unit-tested.
 */

export const GRID_W = 24
export const GRID_H = 14

/** default footprint when creating a table */
export const DEFAULT_TABLE = { w: 3, h: 2 }

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function inBounds(b: Box, gridW = GRID_W, gridH = GRID_H): boolean {
  return b.x >= 0 && b.y >= 0 && b.w >= 1 && b.h >= 1 && b.x + b.w <= gridW && b.y + b.h <= gridH
}

/** boxes that occupy space in a room: visible tables + decor */
export function roomBoxes(roomId: string, tables: Table[], decor: Decor[], ignoreId?: string): Box[] {
  return [
    ...tables.filter((t) => t.roomId === roomId && !t.hidden && t.id !== ignoreId),
    ...decor.filter((d) => d.roomId === roomId && d.id !== ignoreId),
  ]
}

/** true when `box` fits in the room without hitting anything */
export function canPlace(
  box: Box,
  roomId: string,
  tables: Table[],
  decor: Decor[],
  ignoreId?: string,
  gridH = GRID_H,
): boolean {
  if (!inBounds(box, GRID_W, gridH)) return false
  return !roomBoxes(roomId, tables, decor, ignoreId).some((b) => boxesOverlap(box, b))
}

/** first free spot for a w×h box, scanning rows; null when the room is full */
export function findFreeSpot(
  roomId: string,
  tables: Table[],
  decor: Decor[],
  w = DEFAULT_TABLE.w,
  h = DEFAULT_TABLE.h,
  gridH = GRID_H,
): { x: number; y: number } | null {
  for (let y = 0; y + h <= gridH; y++) {
    for (let x = 0; x + w <= GRID_W; x++) {
      if (canPlace({ x, y, w, h }, roomId, tables, decor, undefined, gridH)) return { x, y }
    }
  }
  return null
}

/** rooms can grow downwards when tables are placed below the default grid */
export function roomHeight(roomId: string, tables: Table[], decor: Decor[]): number {
  const maxY = Math.max(GRID_H, ...roomBoxes(roomId, tables, decor).map((b) => b.y + b.h + 1))
  return maxY
}

/**
 * Splits a table footprint into n sub-boxes (F2-R31): 2 → side-by-side
 * halves; 3–4 → quadrants. Sub-boxes always stay inside the parent box.
 */
export function splitBox(box: Box, n: number): Box[] {
  const w1 = Math.max(1, Math.floor(box.w / 2))
  const w2 = Math.max(1, box.w - w1)
  if (n <= 2) {
    return [
      { x: box.x, y: box.y, w: w1, h: box.h },
      { x: box.x + w1, y: box.y, w: w2, h: box.h },
    ]
  }
  const h1 = Math.max(1, Math.floor(box.h / 2))
  const h2 = Math.max(1, box.h - h1)
  return [
    { x: box.x, y: box.y, w: w1, h: h1 },
    { x: box.x + w1, y: box.y, w: w2, h: h1 },
    { x: box.x, y: box.y + h1, w: w1, h: h2 },
    { x: box.x + w1, y: box.y + h1, w: w2, h: h2 },
  ].slice(0, n)
}

/**
 * Assigns a position/shape to legacy tables that predate the floor plan
 * (F2-R6 migration). Tables that already have a layout are left untouched;
 * the rest are placed row by row without overlapping anything.
 */
export function autoLayoutTables<T extends Partial<Table> & { id: string; roomId: string; seats?: number }>(
  tables: T[],
  decor: Decor[] = [],
): (T & Box & { shape: Table['shape'] })[] {
  const placed: Table[] = tables.filter(
    (t) => typeof t.x === 'number' && typeof t.w === 'number',
  ) as unknown as Table[]

  return tables.map((t) => {
    if (typeof t.x === 'number' && typeof t.w === 'number') {
      return { shape: 'square', ...t } as T & Box & { shape: Table['shape'] }
    }
    const w = DEFAULT_TABLE.w
    const h = DEFAULT_TABLE.h
    // allow the grid to grow: try normal height first, then extend
    const spot =
      findFreeSpot(t.roomId, placed, decor, w, h) ??
      findFreeSpot(t.roomId, placed, decor, w, h, 200) ?? { x: 0, y: 0 }
    const laid = {
      ...t,
      x: spot.x,
      y: spot.y,
      w,
      h,
      shape: (t.seats ?? 4) <= 2 ? ('square' as const) : ('rect' as const),
    }
    placed.push(laid as unknown as Table)
    return laid as T & Box & { shape: Table['shape'] }
  })
}
