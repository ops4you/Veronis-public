import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, MoreVertical, Trash2, type LucideIcon } from 'lucide-react'
import type { Widget } from '../../lib/types'
import { ACCENTS, accent } from '../../lib/palette'
import { useStore } from '../../store/useStore'

interface Props {
  widget: Widget
  title: string
  subtitle?: string
  icon: LucideIcon
  children: ReactNode
  /** stat tiles are shorter than chart cards */
  tall?: boolean
}

export function WidgetCard({ widget, title, subtitle, icon: Icon, children, tall }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { removeWidget, moveWidget, setWidgetAccent, setWidgetSize } = useStore()
  const a = accent(widget.accent)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  return (
    <section
      className={`relative flex flex-col rounded-2xl border border-stone-200/80 bg-surface p-4 shadow-card ${
        widget.size === 2 ? 'sm:col-span-2' : ''
      } ${tall ? 'min-h-[280px]' : 'min-h-[150px]'}`}
      aria-label={title}
    >
      <header className="mb-2 flex items-start gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: a.tint, color: a.color }}
          aria-hidden="true"
        >
          <Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-stone-900">{title}</h3>
          {subtitle && <p className="truncate text-xs text-stone-500">{subtitle}</p>}
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
            aria-label={`Customise ${title} widget`}
            aria-expanded={menuOpen}
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-30 w-52 rounded-xl border border-stone-200 bg-white p-3 shadow-xl">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">Colour</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {ACCENTS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setWidgetAccent(widget.id, opt.key)}
                    className="h-6 w-6 rounded-full border-2"
                    style={{
                      background: opt.color,
                      borderColor: widget.accent === opt.key ? '#0b0b0b' : 'transparent',
                    }}
                    aria-label={`${opt.label}${widget.accent === opt.key ? ' (selected)' : ''}`}
                    title={opt.label}
                  />
                ))}
              </div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-stone-400">Width</p>
              <div className="mb-3 flex gap-1.5">
                {([1, 2] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => setWidgetSize(widget.id, size)}
                    className={`flex-1 rounded-lg border px-2 py-1 text-xs font-medium ${
                      widget.size === size
                        ? 'border-stone-900 bg-stone-900 text-white'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    {size === 1 ? 'Narrow' : 'Wide'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => moveWidget(widget.id, -1)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                  aria-label="Move earlier"
                >
                  <ArrowLeft size={13} /> Move
                </button>
                <button
                  onClick={() => moveWidget(widget.id, 1)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-stone-200 px-2 py-1.5 text-xs text-stone-600 hover:bg-stone-50"
                  aria-label="Move later"
                >
                  Move <ArrowRight size={13} />
                </button>
                <button
                  onClick={() => removeWidget(widget.id)}
                  className="rounded-lg border border-red-100 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                  aria-label="Remove widget"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}
