import { type ReactNode } from 'react'
import { Lock, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { DAY_NAMES, fmtHour } from '../lib/format'
import { effectivePlan, maxRooms, maxTables } from '../lib/plans'

export function SettingsPage() {
  const {
    settings,
    rooms,
    tables,
    updateSettings,
    addRoom,
    renameRoom,
    deleteRoom,
    addTable,
    deleteTable,
    seedDemo,
    clearAllData,
    plan,
    trialEndsAt,
  } = useStore()

  const currentPlan = effectivePlan(plan, trialEndsAt)
  const roomsAtLimit = rooms.length >= maxRooms(currentPlan)
  const tablesAtLimit = tables.length >= maxTables(currentPlan)

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-bold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500">Make Veronis fit your business</p>
      </header>

      {/* Business */}
      <Section title="Business">
        <div className="flex flex-wrap gap-3">
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-xs font-medium text-stone-500">Business name</span>
            <input
              value={settings.businessName}
              onChange={(e) => updateSettings({ businessName: e.target.value })}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="w-40">
            <span className="mb-1 block text-xs font-medium text-stone-500">Currency</span>
            <select
              value={settings.currency}
              onChange={(e) => updateSettings({ currency: e.target.value })}
              className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              <option value="EUR">€ Euro</option>
              <option value="USD">$ US Dollar</option>
              <option value="GBP">£ Pound</option>
              <option value="BRL">R$ Real</option>
            </select>
          </label>
        </div>
      </Section>

      {/* Opening hours */}
      <Section
        title="Opening hours"
        hint="The quiet-hours widget only looks at hours you are actually open."
      >
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const on = settings.opening.openDays.includes(d)
            return (
              <button
                key={d}
                onClick={() =>
                  updateSettings({
                    opening: {
                      ...settings.opening,
                      openDays: on
                        ? settings.opening.openDays.filter((x) => x !== d)
                        : [...settings.opening.openDays, d],
                    },
                  })
                }
                aria-pressed={on}
                className={`rounded-xl px-3 py-1.5 text-sm font-medium ${
                  on ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-400 hover:bg-stone-100'
                }`}
              >
                {DAY_NAMES[d]}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-stone-600">
            Open from
            <HourSelect
              value={settings.opening.openHour}
              max={settings.opening.closeHour - 1}
              onChange={(h) => updateSettings({ opening: { ...settings.opening, openHour: h } })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            until
            <HourSelect
              value={settings.opening.closeHour}
              min={settings.opening.openHour + 1}
              onChange={(h) => updateSettings({ opening: { ...settings.opening, closeHour: h } })}
            />
          </label>
        </div>
      </Section>

      {/* Rooms & tables */}
      <Section title="Rooms & tables" hint="This is the layout the Service page shows.">
        <div className="space-y-4">
          {rooms.map((room) => {
            const roomTables = tables.filter((t) => t.roomId === room.id)
            return (
              <div key={room.id} className="rounded-xl border border-stone-200 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={room.name}
                    onChange={(e) => renameRoom(room.id, e.target.value)}
                    className="rounded-lg border border-transparent px-2 py-1 text-sm font-semibold text-stone-900 hover:border-stone-200 focus:border-brand-500 focus:outline-none"
                    aria-label="Room name"
                  />
                  <span className="text-xs text-stone-400">{roomTables.length} tables</span>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete room "${room.name}" and its tables?`)) deleteRoom(room.id)
                    }}
                    className="ml-auto rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${room.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {roomTables.map((t) => (
                    <span key={t.id} className="group flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-sm">
                      <span className="font-medium text-stone-800">{t.name}</span>
                      <span className="text-xs text-stone-400">{t.seats}p</span>
                      <button
                        onClick={() => deleteTable(t.id)}
                        className="text-stone-300 hover:text-red-600"
                        aria-label={`Remove table ${t.name}`}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                  {tablesAtLimit ? (
                    <Link
                      to="/plans"
                      className="flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-sm text-stone-400 hover:text-stone-600"
                      title="The Basic plan includes up to 10 tables"
                    >
                      <Lock size={12} /> Table limit — see plans
                    </Link>
                  ) : (
                    <AddTableButton
                      onAdd={(name, seats) => addTable(room.id, name, seats)}
                      nextName={`T${roomTables.length + 1}`}
                    />
                  )}
                </div>
              </div>
            )
          })}
          {roomsAtLimit ? (
            <Link
              to="/plans"
              className="flex w-fit items-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3.5 py-2 text-sm text-stone-400 hover:text-stone-600"
              title="The Basic plan includes 1 room"
            >
              <Lock size={14} /> More rooms are included in Standard — see plans
            </Link>
          ) : (
            <button
              onClick={() => {
                const name = window.prompt('Room name (e.g. Terrace)')
                if (name?.trim()) addRoom(name.trim())
              }}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3.5 py-2 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
            >
              <Plus size={15} /> Add room
            </button>
          )}
        </div>
      </Section>

      {/* Data */}
      <Section title="Data" hint="Everything is stored locally in this browser.">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              if (window.confirm('Replace everything with the demo data (Café Aurora)?')) seedDemo()
            }}
            className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Load demo data
          </button>
          <button
            onClick={() => {
              if (window.confirm('Delete ALL data — sales, menu, tables, everything? This cannot be undone.')) clearAllData()
            }}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Clear all data
          </button>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card">
      <h2 className="font-semibold text-stone-900">{title}</h2>
      {hint && <p className="mb-3 mt-0.5 text-xs text-stone-500">{hint}</p>}
      {!hint && <div className="mb-3" />}
      {children}
    </section>
  )
}

function HourSelect({
  value,
  onChange,
  min = 0,
  max = 24,
}: {
  value: number
  onChange: (h: number) => void
  min?: number
  max?: number
}) {
  const hours: number[] = []
  for (let h = min; h <= max; h++) hours.push(h)
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
    >
      {hours.map((h) => (
        <option key={h} value={h}>
          {fmtHour(h)}
        </option>
      ))}
    </select>
  )
}

function AddTableButton({ onAdd, nextName }: { onAdd: (name: string, seats: number) => void; nextName: string }) {
  return (
    <button
      onClick={() => {
        const name = window.prompt('Table name', nextName)
        if (!name?.trim()) return
        const seats = Number(window.prompt('Seats', '4') ?? '4')
        onAdd(name.trim(), Number.isFinite(seats) && seats > 0 ? seats : 4)
      }}
      className="flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
    >
      <Plus size={13} /> Table
    </button>
  )
}
