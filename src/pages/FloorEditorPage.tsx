import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  Coffee,
  Copy,
  DoorOpen,
  Flower2,
  Minus,
  Plus,
  RotateCw,
  Square,
  Trash2,
} from 'lucide-react'
import { useStore } from '../store/useStore'
import { useTranslation } from '../lib/i18n'
import type { Decor, Table, TableShape } from '../lib/types'
import { canPlace, findFreeSpot, GRID_H, GRID_W, roomHeight, type Box } from '../lib/floor'
import { boxStyle, DecorVisual, gridBackground, shapeClass, useCellSize } from '../components/floor/floorRender'
import { Modal } from '../components/ui/Modal'

interface DragState {
  id: string
  isDecor: boolean
  mode: 'move' | 'resize'
  box: Box
  valid: boolean
  grabDX: number
  grabDY: number
}

export function FloorEditorPage() {
  const { t } = useTranslation()
  const {
    rooms,
    tables,
    decor,
    addRoom,
    renameRoom,
    deleteRoom,
    duplicateRoom,
    addTable,
    batchAddTables,
    updateTable,
    deleteTable,
    addDecor,
    updateDecor,
    deleteDecor,
  } = useStore()

  const [roomId, setRoomId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const cell = useCellSize(canvasRef)

  const currentRoomId = roomId ?? rooms[0]?.id ?? null
  const roomTables = useMemo(
    () => tables.filter((x) => x.roomId === currentRoomId && !x.hidden),
    [tables, currentRoomId],
  )
  const roomDecor = useMemo(() => decor.filter((d) => d.roomId === currentRoomId), [decor, currentRoomId])
  // leave two spare rows so elements can be dragged below the current content
  const gridH = Math.max(GRID_H, currentRoomId ? roomHeight(currentRoomId, tables, decor) + 2 : GRID_H)

  const selectedTable = roomTables.find((x) => x.id === selectedId) ?? null
  const selectedDecor = roomDecor.find((d) => d.id === selectedId) ?? null

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 3000)
  }

  const pointerPos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { px: (e.clientX - rect.left) / cell, py: (e.clientY - rect.top) / cell }
  }

  const startDrag = (e: React.PointerEvent, el: Box & { id: string }, isDecor: boolean, mode: DragState['mode']) => {
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(el.id)
    const { px, py } = pointerPos(e)
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* synthetic events have no active pointer — drag still works via bubbling */
    }
    setDrag({ id: el.id, isDecor, mode, box: { x: el.x, y: el.y, w: el.w, h: el.h }, valid: true, grabDX: px - el.x, grabDY: py - el.y })
  }

  const onDragMove = (e: React.PointerEvent) => {
    if (!drag || !currentRoomId) return
    const { px, py } = pointerPos(e)
    const el = drag.isDecor ? roomDecor.find((d) => d.id === drag.id) : roomTables.find((x) => x.id === drag.id)
    if (!el) return
    let box: Box
    if (drag.mode === 'move') {
      const x = Math.max(0, Math.min(GRID_W - drag.box.w, Math.round(px - drag.grabDX)))
      const y = Math.max(0, Math.min(gridH - drag.box.h, Math.round(py - drag.grabDY)))
      box = { ...drag.box, x, y }
    } else {
      let w = Math.max(1, Math.min(GRID_W - el.x, Math.round(px - el.x)))
      let h = Math.max(1, Math.min(gridH - el.y, Math.round(py - el.y)))
      if (!drag.isDecor && (el as Table).shape === 'round') w = h = Math.max(w, h) // round stays round
      box = { x: el.x, y: el.y, w, h }
    }
    const valid = canPlace(box, currentRoomId, tables, decor, drag.id, gridH)
    setDrag({ ...drag, box, valid })
  }

  const endDrag = () => {
    if (drag && drag.valid) {
      if (drag.isDecor) updateDecor(drag.id, drag.box)
      else updateTable(drag.id, drag.box)
    }
    setDrag(null)
  }

  const nextTableName = () => {
    let n = 1
    for (const x of tables.filter((x) => x.roomId === currentRoomId)) {
      const m = x.name.match(/^T(\d+)$/)
      if (m) n = Math.max(n, Number(m[1]) + 1)
    }
    return `T${n}`
  }

  const handleAddTable = () => {
    if (!currentRoomId) return
    if (!findFreeSpot(currentRoomId, tables, decor, 3, 2, gridH + 6)) return flash(t('floor.roomFull'))
    addTable(currentRoomId, nextTableName(), 4)
  }

  const handleAddDecor = (kind: Decor['kind']) => {
    if (!currentRoomId) return
    if (addDecor(currentRoomId, kind) === null) flash(t('floor.roomFull'))
  }

  const boxOf = (id: string): Box | null => {
    if (drag?.id === id) return drag.box
    const table = roomTables.find((x) => x.id === id)
    if (table) return table
    return roomDecor.find((d) => d.id === id) ?? null
  }

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-stone-900">{t('floor.editorTitle')}</h1>
          <p className="text-sm text-stone-500">{t('floor.editorSubtitle')}</p>
        </div>
        {notice && (
          <span role="status" className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            {notice}
          </span>
        )}
        <Link
          to="/settings"
          className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          <Check size={15} /> {t('floor.done')}
        </Link>
      </header>

      {/* Room tabs */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {rooms.map((r) =>
          r.id === currentRoomId ? (
            <span key={r.id} className="flex items-center gap-1 rounded-xl bg-stone-900 pl-3 pr-1 text-sm font-medium text-white">
              <input
                value={r.name}
                onChange={(e) => renameRoom(r.id, e.target.value)}
                className="w-28 bg-transparent py-2 text-sm font-medium text-white focus:outline-none"
                aria-label={t('floor.roomName')}
              />
              <button
                onClick={() => {
                  const id = duplicateRoom(r.id)
                  if (id) setRoomId(id)
                }}
                className="rounded-lg p-1.5 text-stone-300 hover:bg-stone-700 hover:text-white"
                title={t('floor.duplicateRoom')}
                aria-label={t('floor.duplicateRoom')}
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t('floor.deleteRoomConfirm', { name: r.name }))) {
                    deleteRoom(r.id)
                    setRoomId(null)
                  }
                }}
                className="rounded-lg p-1.5 text-stone-300 hover:bg-red-600 hover:text-white"
                title={t('floor.deleteRoom')}
                aria-label={t('floor.deleteRoom')}
              >
                <Trash2 size={14} />
              </button>
            </span>
          ) : (
            <button
              key={r.id}
              onClick={() => {
                setRoomId(r.id)
                setSelectedId(null)
              }}
              className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              {r.name}
            </button>
          ),
        )}
        <button
          onClick={() => {
            const name = window.prompt(t('floor.roomName'))
            if (name?.trim()) setRoomId(addRoom(name.trim()))
          }}
          className="flex items-center gap-1 rounded-xl border border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
        >
          <Plus size={14} /> {t('floor.addRoom')}
        </button>
      </div>

      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <button onClick={handleAddTable} className="flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus size={14} /> {t('floor.addTable')}
        </button>
        <button onClick={() => setBatchOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
          <Plus size={14} /> {t('floor.addBatch')}
        </button>
        <span className="mx-1 h-6 w-px bg-stone-200" aria-hidden="true" />
        <button onClick={() => handleAddDecor('counter')} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
          <Coffee size={14} /> {t('floor.counter')}
        </button>
        <button onClick={() => handleAddDecor('door')} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
          <DoorOpen size={14} /> {t('floor.door')}
        </button>
        <button onClick={() => handleAddDecor('wall')} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
          <Minus size={14} /> {t('floor.wall')}
        </button>
        <button onClick={() => handleAddDecor('plant')} className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50">
          <Flower2 size={14} /> {t('floor.plant')}
        </button>
        <span className="ml-auto hidden text-xs text-stone-400 md:block">{t('floor.selectHint')}</span>
      </div>

      {/* Canvas */}
      <div
        ref={canvasRef}
        className="relative touch-none select-none overflow-hidden rounded-2xl border border-stone-200 bg-surface shadow-card"
        style={{ height: gridH * cell, ...gridBackground(cell) }}
        onPointerDown={() => setSelectedId(null)}
      >
        {roomDecor.map((d) => {
          const box = drag?.id === d.id ? drag.box : d
          const isSel = selectedId === d.id
          return (
            <div
              key={d.id}
              style={boxStyle(box, cell)}
              className={`${drag?.id === d.id ? (drag.valid ? 'opacity-80' : 'opacity-50') : ''} ${isSel ? 'z-10' : ''}`}
              onPointerDown={(e) => startDrag(e, { ...box, id: d.id }, true, 'move')}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
            >
              <DecorVisual decor={d} cell={cell} />
              {isSel && <ResizeHandle onPointerDown={(e) => startDrag(e, { ...box, id: d.id }, true, 'resize')} />}
              {isSel && drag?.id !== d.id && (
                <div
                  className={`pointer-events-none absolute inset-0 rounded-md ring-2 ${drag && !drag.valid ? 'ring-red-500' : 'ring-brand-600'}`}
                />
              )}
            </div>
          )
        })}

        {roomTables.map((x) => {
          const box = drag?.id === x.id ? drag.box : x
          const isSel = selectedId === x.id
          const invalid = drag?.id === x.id && !drag.valid
          return (
            <div
              key={x.id}
              style={boxStyle(box, cell)}
              className="z-10 cursor-grab active:cursor-grabbing"
              onPointerDown={(e) => startDrag(e, { ...box, id: x.id }, false, 'move')}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
            >
              <div
                className={`flex h-full w-full flex-col items-center justify-center border-2 bg-white shadow-card ${shapeClass(x.shape)} ${
                  invalid ? 'border-red-500 bg-red-50' : isSel ? 'border-brand-600' : 'border-stone-300'
                } ${x.extra ? 'border-dashed' : ''}`}
              >
                <span className="max-w-full truncate px-1 text-xs font-bold text-stone-900" style={{ fontSize: Math.min(13, cell * 0.55) }}>
                  {x.name}
                </span>
                {cell * box.h >= 34 && <span className="text-[10px] text-stone-400">{x.seats}p</span>}
              </div>
              {isSel && <ResizeHandle onPointerDown={(e) => startDrag(e, { ...box, id: x.id }, false, 'resize')} />}
            </div>
          )
        })}
      </div>

      {/* Selection panel */}
      {(selectedTable || selectedDecor) && (
        <div className="mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-card">
          {selectedTable && (
            <>
              <label className="w-36">
                <span className="mb-1 block text-xs font-medium text-stone-500">{t('floor.tableName')}</span>
                <input
                  value={selectedTable.name}
                  onChange={(e) => updateTable(selectedTable.id, { name: e.target.value })}
                  className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
                />
              </label>
              <label className="w-28">
                <span className="mb-1 block text-xs font-medium text-stone-500">{t('floor.seats')}</span>
                <div className="flex items-center rounded-xl border border-stone-200">
                  <button
                    onClick={() => updateTable(selectedTable.id, { seats: Math.max(1, selectedTable.seats - 1) })}
                    className="p-2 text-stone-500 hover:text-stone-900"
                    aria-label="-1"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="flex-1 text-center text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {selectedTable.seats}
                  </span>
                  <button
                    onClick={() => updateTable(selectedTable.id, { seats: selectedTable.seats + 1 })}
                    className="p-2 text-stone-500 hover:text-stone-900"
                    aria-label="+1"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-stone-500">{t('floor.shape')}</span>
                <div className="flex gap-1">
                  {(
                    [
                      ['square', t('floor.shapeSquare')],
                      ['round', t('floor.shapeRound')],
                      ['rect', t('floor.shapeRect')],
                    ] as [TableShape, string][]
                  ).map(([shape, label]) => (
                    <button
                      key={shape}
                      onClick={() => {
                        const patch: Partial<Table> = { shape }
                        if (shape === 'round') patch.h = patch.w = Math.max(selectedTable.w, selectedTable.h)
                        if (shape === 'rect' && selectedTable.w === selectedTable.h) patch.w = selectedTable.w + 1
                        if (currentRoomId && canPlace({ ...selectedTable, ...patch } as Box, currentRoomId, tables, decor, selectedTable.id, gridH))
                          updateTable(selectedTable.id, patch)
                        else updateTable(selectedTable.id, { shape })
                      }}
                      className={`rounded-lg border px-2.5 py-2 text-xs font-medium ${
                        selectedTable.shape === shape ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  const box = { x: selectedTable.x, y: selectedTable.y, w: selectedTable.h, h: selectedTable.w }
                  if (currentRoomId && canPlace(box, currentRoomId, tables, decor, selectedTable.id, gridH))
                    updateTable(selectedTable.id, box)
                  else flash(t('floor.roomFull'))
                }}
                className="flex items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-2 text-sm text-stone-600 hover:bg-stone-50"
              >
                <RotateCw size={14} /> {t('floor.rotate')}
              </button>
              <button
                onClick={() => {
                  if (window.confirm(t('floor.deleteTableConfirm', { name: selectedTable.name }))) {
                    deleteTable(selectedTable.id)
                    setSelectedId(null)
                  }
                }}
                className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                <Trash2 size={14} /> {t('floor.deleteElement')}
              </button>
            </>
          )}
          {selectedDecor && (
            <>
              <span className="flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-600">
                <Square size={14} className="text-stone-400" /> {t(`floor.${selectedDecor.kind}`)}
              </span>
              <button
                onClick={() => {
                  deleteDecor(selectedDecor.id)
                  setSelectedId(null)
                }}
                className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
              >
                <Trash2 size={14} /> {t('floor.deleteElement')}
              </button>
            </>
          )}
        </div>
      )}

      {batchOpen && currentRoomId && (
        <BatchModal
          onClose={() => setBatchOpen(false)}
          onAdd={(count, prefix, seats, shape) => {
            const created = batchAddTables(currentRoomId, count, prefix, seats, shape)
            setBatchOpen(false)
            flash(created === count ? t('floor.batchAdded', { count: created }) : t('floor.batchPartial', { count: created }))
          }}
        />
      )}
    </div>
  )
}

function ResizeHandle({ onPointerDown }: { onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute -bottom-1.5 -right-1.5 z-20 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-brand-600 shadow"
      aria-label="resize"
    />
  )
}

function BatchModal({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (count: number, prefix: string, seats: number, shape: TableShape) => void
}) {
  const { t } = useTranslation()
  const [count, setCount] = useState('10')
  const [prefix, setPrefix] = useState('T')
  const [seats, setSeats] = useState('4')
  const [shape, setShape] = useState<TableShape>('square')

  return (
    <Modal title={t('floor.batchTitle')} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const n = Math.max(1, Math.min(50, Number(count) || 0))
          onAdd(n, prefix.trim() || 'T', Math.max(1, Number(seats) || 4), shape)
        }}
        className="space-y-3"
      >
        <div className="flex gap-3">
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('floor.batchCount')}</span>
            <input value={count} onChange={(e) => setCount(e.target.value)} inputMode="numeric" autoFocus className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('floor.batchPrefix')}</span>
            <input value={prefix} onChange={(e) => setPrefix(e.target.value)} className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </label>
          <label className="flex-1">
            <span className="mb-1 block text-sm font-medium text-stone-700">{t('floor.seats')}</span>
            <input value={seats} onChange={(e) => setSeats(e.target.value)} inputMode="numeric" className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
          </label>
        </div>
        <div>
          <span className="mb-1 block text-sm font-medium text-stone-700">{t('floor.shape')}</span>
          <div className="flex gap-1.5">
            {(
              [
                ['square', t('floor.shapeSquare')],
                ['round', t('floor.shapeRound')],
                ['rect', t('floor.shapeRect')],
              ] as [TableShape, string][]
            ).map(([s, label]) => (
              <button
                type="button"
                key={s}
                onClick={() => setShape(s)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                  shape === s ? 'border-stone-900 bg-stone-900 text-white' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">
            {t('common.cancel')}
          </button>
          <button type="submit" className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            {t('common.add')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
