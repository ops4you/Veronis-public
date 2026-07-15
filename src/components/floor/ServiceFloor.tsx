import { useMemo, useRef, useState } from 'react'
import { Scissors, Undo2 } from 'lucide-react'
import { useStore } from '../../store/useStore'
import { useTranslation } from '../../lib/i18n'
import { fmtMoney } from '../../lib/format'
import { GRID_H, roomHeight } from '../../lib/floor'
import { boxStyle, DecorVisual, gridBackground, shapeClass, useCellSize } from './floorRender'
import { STATUS_STYLE } from '../pos/status'
import { Modal } from '../ui/Modal'
import type { Table } from '../../lib/types'

interface Props {
  roomId: string
  onOpenTable: (tableId: string) => void
}

/**
 * F2-R4: the Service screen renders the room exactly like the floor plan —
 * table state by colour, tap opens the order. Free tables can be split into
 * sub-tables (F2-R31) and rejoined; ad-hoc extras show dashed (F2-R30).
 */
export function ServiceFloor({ roomId, onOpenTable }: Props) {
  const { t } = useTranslation()
  const { tables, decor, orders, settings, divideTable, rejoinTable } = useStore()
  const [dividing, setDividing] = useState<Table | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const cell = useCellSize(canvasRef)

  const roomTables = useMemo(() => tables.filter((x) => x.roomId === roomId && !x.hidden), [tables, roomId])
  const roomDecor = useMemo(() => decor.filter((d) => d.roomId === roomId), [decor, roomId])
  const gridH = Math.max(GRID_H, roomHeight(roomId, tables, decor))

  const orderFor = (tableId: string) => orders.find((o) => o.tableId === tableId)

  const siblingsFree = (parentId: string) =>
    tables
      .filter((x) => x.parentTableId === parentId)
      .every((sub) => !orders.some((o) => o.tableId === sub.id))

  return (
    <>
      <div
        ref={canvasRef}
        className="relative select-none overflow-hidden rounded-2xl border border-stone-200 bg-surface shadow-card"
        style={{ height: gridH * cell, ...gridBackground(cell) }}
      >
        {roomDecor.map((d) => (
          <div key={d.id} style={boxStyle(d, cell)}>
            <DecorVisual decor={d} cell={cell} />
          </div>
        ))}

        {roomTables.map((x) => {
          const order = orderFor(x.id)
          const st = order ? STATUS_STYLE[order.status] : null
          const total = order ? order.items.reduce((acc, i) => acc + i.qty * i.unitPrice, 0) : 0
          const canDivide = !order && !x.parentTableId
          const canRejoin = !!x.parentTableId && siblingsFree(x.parentTableId)
          return (
            <div key={x.id} style={boxStyle(x, cell)} className="z-10">
              <button
                onClick={() => onOpenTable(x.id)}
                className={`flex h-full w-full flex-col items-center justify-center border-2 shadow-card transition-transform active:scale-[0.97] ${shapeClass(
                  x.shape,
                )} ${st ? st.tile : 'border-stone-300 bg-white hover:border-stone-400'} ${x.extra ? 'border-dashed' : ''}`}
                aria-label={x.name}
              >
                <span className="max-w-full truncate px-1 font-bold text-stone-900" style={{ fontSize: Math.min(13, cell * 0.55) }}>
                  {x.name}
                </span>
                {cell * x.h >= 34 && (
                  <span className="text-[10px] text-stone-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {order ? fmtMoney(total, settings.currency) : `${x.seats}p`}
                  </span>
                )}
              </button>
              {canDivide && x.w >= 2 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDividing(x)
                  }}
                  className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow hover:border-brand-500 hover:text-brand-600"
                  title={t('floor.divide')}
                  aria-label={`${t('floor.divide')} ${x.name}`}
                >
                  <Scissors size={12} />
                </button>
              )}
              {canRejoin && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    rejoinTable(x.parentTableId!)
                  }}
                  className="absolute -right-1.5 -top-1.5 z-20 flex h-6 w-6 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-400 shadow hover:border-brand-500 hover:text-brand-600"
                  title={t('floor.rejoin')}
                  aria-label={`${t('floor.rejoin')} ${x.name}`}
                >
                  <Undo2 size={12} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {dividing && (
        <Modal title={t('floor.divideTitle', { name: dividing.name })} onClose={() => setDividing(null)}>
          <p className="mb-3 text-sm text-stone-500">{t('floor.divideHint')}</p>
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('floor.divideInto')}</span>
          <div className="flex gap-2">
            {[2, 3, 4]
              .filter((n) => n === 2 || dividing.h >= 2)
              .map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    divideTable(dividing.id, n)
                    setDividing(null)
                  }}
                  className="flex-1 rounded-xl border border-stone-200 px-3 py-3 text-sm font-semibold text-stone-700 hover:border-brand-500 hover:bg-brand-50/40"
                >
                  {t('floor.divideParts', { n })}
                </button>
              ))}
          </div>
        </Modal>
      )}
    </>
  )
}
