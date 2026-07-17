import { useEffect, useRef, useState, type RefObject } from 'react'
import { Coffee, DoorOpen, Flower2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import type { Decor, TableShape } from '../../lib/types'
import { GRID_W, type Box } from '../../lib/floor'

/** px per grid cell, measured from the canvas container width */
export function useCellSize(ref: RefObject<HTMLElement>): number {
  const [cell, setCell] = useState(24)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setCell(el.clientWidth / GRID_W)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return cell
}

export function boxStyle(box: Box, cell: number): CSSProperties {
  return {
    position: 'absolute',
    left: box.x * cell,
    top: box.y * cell,
    width: box.w * cell,
    height: box.h * cell,
  }
}

export function shapeClass(shape: TableShape): string {
  return shape === 'round' ? 'rounded-full' : 'rounded-lg'
}

/** grid backdrop for the canvas */
export function gridBackground(cell: number): CSSProperties {
  return {
    backgroundImage:
      'linear-gradient(to right, rgba(28,25,23,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(28,25,23,0.05) 1px, transparent 1px)',
    backgroundSize: `${cell}px ${cell}px`,
  }
}

const DECOR_VISUAL = {
  counter: { cls: 'bg-stone-200 border-stone-300 text-stone-500', icon: Coffee },
  door: { cls: 'border-dashed border-stone-400 bg-white/60 text-stone-400', icon: DoorOpen },
  wall: { cls: 'bg-stone-300 border-stone-400 text-stone-500', icon: null },
  plant: { cls: 'bg-green-50 border-green-200 text-green-600', icon: Flower2 },
} as const

export function DecorVisual({ decor, cell }: { decor: Decor; cell: number }) {
  const v = DECOR_VISUAL[decor.kind]
  const Icon = v.icon
  return (
    <div
      className={`pointer-events-none flex items-center justify-center rounded-md border ${v.cls}`}
      style={{ width: '100%', height: '100%' }}
    >
      {Icon && cell * Math.min(decor.w, decor.h) >= 20 && <Icon size={Math.min(18, cell)} />}
    </div>
  )
}
