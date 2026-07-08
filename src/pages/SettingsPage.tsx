import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Download, Lock, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { DAY_NAMES, fmtHour } from '../lib/format'
import { effectivePlan, maxRooms, maxTables } from '../lib/plans'
import { downloadBackupFile, validateBackup } from '../lib/backup'
import { api, ApiError, type TeamMember } from '../lib/api'
import { isLocalMode } from '../lib/mode'

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

      {/* Account & team (web accounts) */}
      {!isLocalMode && <AccountSection />}
      {!isLocalMode && <TeamSection />}

      {/* Data */}
      <DataSection seedDemo={seedDemo} clearAllData={clearAllData} />
    </div>
  )
}

function AccountSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const input =
    'w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

  return (
    <Section title="Account" hint="Changing your password signs you out everywhere else.">
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setMessage(null)
          if (next !== confirm) {
            setMessage({ text: 'The new passwords do not match.', ok: false })
            return
          }
          setBusy(true)
          try {
            await api.changePassword(current, next)
            setCurrent('')
            setNext('')
            setConfirm('')
            setMessage({ text: 'Password changed.', ok: true })
          } catch (err) {
            setMessage({ text: err instanceof ApiError ? err.message : 'Could not reach the server.', ok: false })
          } finally {
            setBusy(false)
          }
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">Current password</span>
          <input className={input} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">New password (min. 8)</span>
          <input className={input} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">Repeat new password</span>
          <input className={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          Change password
        </button>
      </form>
      {message && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}
    </Section>
  )
}

function TeamSection() {
  const [team, setTeam] = useState<TeamMember[] | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    api
      .listUsers()
      .then(({ users }) => setTeam(users))
      .catch(() => setTeam([]))

  useEffect(() => {
    void load()
  }, [])

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      const { invited } = await api.createEmployee(name.trim(), email.trim(), password)
      setName('')
      setEmail('')
      setPassword('')
      setMessage({
        text: invited
          ? 'Invite sent — they choose their own password from the email link (valid 48 h).'
          : 'Employee account created — share the email and password with them.',
        ok: true,
      })
      await load()
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : 'Could not reach the server.', ok: false })
    } finally {
      setBusy(false)
    }
  }

  const input =
    'w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

  return (
    <Section
      title="Team"
      hint="Employees sign in with their own email and password. They see Service, Kitchen and their own sales only."
    >
      {team === null ? (
        <p className="text-sm text-stone-400">Loading team…</p>
      ) : (
        <ul className="mb-4 divide-y divide-stone-100 rounded-xl border border-stone-200">
          {team.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">
                {m.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-stone-800">{m.name}</span>
                {m.email && <span className="block truncate text-xs text-stone-400">{m.email}</span>}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  m.role === 'admin' ? 'bg-brand-50 text-brand-700' : 'bg-stone-100 text-stone-500'
                }`}
              >
                {m.role}
              </span>
              {m.role === 'employee' && (
                <button
                  onClick={async () => {
                    if (!window.confirm(`Remove ${m.name}'s account? Their past sales stay attributed to them.`)) return
                    try {
                      await api.deleteEmployee(m.id)
                      await load()
                    } catch (err) {
                      setMessage({ text: err instanceof ApiError ? err.message : 'Could not remove.', ok: false })
                    }
                  }}
                  className="rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${m.name}`}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addEmployee} className="flex flex-wrap items-end gap-2">
        <label className="min-w-36 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">Name</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Miguel Costa" />
        </label>
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">Email</span>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="miguel@cafe.pt" />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">Password (optional)</span>
          <input className={input} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="empty = email an invite" />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          <UserPlus size={15} /> Add employee
        </button>
      </form>
      {message && (
        <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}
    </Section>
  )
}

function DataSection({ seedDemo, clearAllData }: { seedDemo: () => void; clearAllData: () => void }) {
  const store = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)

  const handleExport = () => {
    downloadBackupFile({
      settings: store.settings,
      categories: store.categories,
      products: store.products,
      rooms: store.rooms,
      tables: store.tables,
      sales: store.sales,
      expenses: store.expenses,
      widgets: store.widgets,
      plan: store.plan,
      trialEndsAt: store.trialEndsAt,
    })
    setMessage({ text: 'Backup downloaded. Keep it somewhere safe (cloud drive, USB stick).', ok: true })
  }

  const handleImportFile = async (file: File) => {
    const text = await file.text()
    const result = validateBackup(text)
    if (!result.ok) {
      setMessage({ text: result.error, ok: false })
      return
    }
    const when = new Date(result.data.sales[result.data.sales.length - 1]?.at ?? 0)
    if (
      window.confirm(
        `Restore this backup? It contains ${result.data.sales.length} sales (latest: ${when.toLocaleDateString()}), ${result.data.products.length} products.\n\nThis REPLACES everything currently in the app.`,
      )
    ) {
      store.importData(result.data)
      setMessage({ text: 'Backup restored.', ok: true })
    }
  }

  return (
    <Section title="Data" hint="Everything is stored locally on this machine. Export a backup regularly.">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          <Download size={15} /> Export backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <Upload size={15} /> Import backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleImportFile(f)
            e.target.value = ''
          }}
        />
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
      {message && (
        <p
          role="status"
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}
        >
          {message.text}
        </p>
      )}
    </Section>
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
