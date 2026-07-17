import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Download, LayoutGrid, Lock, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStore } from '../store/useStore'
import { DAY_NAMES, fmtHour } from '../lib/format'
import { effectivePlan, maxRooms, maxTables } from '../lib/plans'
import { downloadBackupFile, validateBackup } from '../lib/backup'
import { api, ApiError, type TeamMember } from '../lib/api'
import { isLocalMode } from '../lib/mode'
import { useTranslation } from '../lib/i18n'

export function SettingsPage() {
  const { t } = useTranslation()
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
        <h1 className="text-xl font-bold text-stone-900">{t('settings.title')}</h1>
        <p className="text-sm text-stone-500">{t('settings.subtitle')}</p>
      </header>

      {/* Business */}
      <Section title={t('settings.business')}>
        <div className="flex flex-wrap gap-3">
          <label className="min-w-56 flex-1">
            <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.businessName')}</span>
            <input
              value={settings.businessName}
              onChange={(e) => updateSettings({ businessName: e.target.value })}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>
          <label className="w-40">
            <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.currency')}</span>
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
        title={t('settings.openingHours')}
        hint={t('settings.openingHoursHint')}
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
            {t('settings.openFrom')}
            <HourSelect
              value={settings.opening.openHour}
              max={settings.opening.closeHour - 1}
              onChange={(h) => updateSettings({ opening: { ...settings.opening, openHour: h } })}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-stone-600">
            {t('settings.until')}
            <HourSelect
              value={settings.opening.closeHour}
              min={settings.opening.openHour + 1}
              onChange={(h) => updateSettings({ opening: { ...settings.opening, closeHour: h } })}
            />
          </label>
        </div>
      </Section>

      {/* Rooms & tables */}
      <Section title={t('settings.roomsTables')} hint={t('settings.roomsTablesHint')}>
        <Link
          to="/floor"
          className="mb-4 flex w-fit items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          <LayoutGrid size={15} /> {t('floor.openEditor')}
        </Link>
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
                  <span className="text-xs text-stone-400">{t('settings.tablesCount', { count: roomTables.length })}</span>
                  <button
                    onClick={() => {
                      if (window.confirm(t('settings.deleteRoomConfirm', { name: room.name }))) deleteRoom(room.id)
                    }}
                    className="ml-auto rounded-lg p-1.5 text-stone-300 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Delete ${room.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {roomTables.map((tbl) => (
                    <span key={tbl.id} className="group flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1 text-sm">
                      <span className="font-medium text-stone-800">{tbl.name}</span>
                      <span className="text-xs text-stone-400">{t('settings.tableSeats', { seats: tbl.seats })}</span>
                      <button
                        onClick={() => deleteTable(tbl.id)}
                        className="text-stone-300 hover:text-red-600"
                        aria-label={t('settings.removeTableLabel', { name: tbl.name })}
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ))}
                  {tablesAtLimit ? (
                    <Link
                      to="/plans"
                      className="flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-sm text-stone-400 hover:text-stone-600"
                      title={t('settings.tableLimitHint')}
                    >
                      <Lock size={12} /> {t('settings.tableLimit')}
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
              title={t('settings.roomLimitHint')}
            >
              <Lock size={14} /> {t('settings.roomLimit')}
            </Link>
          ) : (
            <button
              onClick={() => {
                const name = window.prompt(t('settings.roomNamePlaceholder'))
                if (name?.trim()) addRoom(name.trim())
              }}
              className="flex items-center gap-1.5 rounded-xl border border-dashed border-stone-300 px-3.5 py-2 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
            >
              <Plus size={15} /> {t('settings.addRoom')}
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
  const { t } = useTranslation()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  const input =
    'w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

  return (
    <Section title={t('settings.account')} hint={t('settings.accountHint')}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setMessage(null)
          if (next !== confirm) {
            setMessage({ text: t('settings.passwordsDoNotMatch'), ok: false })
            return
          }
          setBusy(true)
          try {
            await api.changePassword(current, next)
            setCurrent('')
            setNext('')
            setConfirm('')
            setMessage({ text: t('settings.passwordChanged'), ok: true })
          } catch (err) {
            setMessage({ text: err instanceof ApiError ? err.message : t('settings.couldNotReachServer'), ok: false })
          } finally {
            setBusy(false)
          }
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.currentPassword')}</span>
          <input className={input} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.newPassword')}</span>
          <input className={input} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.repeatNewPassword')}</span>
          <input className={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {t('settings.changePassword')}
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
  const { t, lang } = useTranslation()
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
          ? t('settings.employeeInvited')
          : t('settings.employeeCreated'),
        ok: true,
      })
      await load()
    } catch (err) {
      setMessage({ text: err instanceof ApiError ? err.message : t('settings.couldNotReachServer'), ok: false })
    } finally {
      setBusy(false)
    }
  }

  const roleLabel = (role: string) => {
    if (role === 'admin') return lang === 'pt' ? 'Administrador' : 'Admin'
    return lang === 'pt' ? 'Funcionário' : 'Employee'
  }

  const input =
    'w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none'

  return (
    <Section
      title={t('settings.team')}
      hint={t('settings.teamHint')}
    >
      {team === null ? (
        <p className="text-sm text-stone-400">{t('settings.loadingTeam')}</p>
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
                {roleLabel(m.role)}
              </span>
              {m.role === 'employee' && (
                <button
                  onClick={async () => {
                    if (!window.confirm(t('settings.removeEmployeeConfirm', { name: m.name }))) return
                    try {
                      await api.deleteEmployee(m.id)
                      await load()
                    } catch (err) {
                      setMessage({ text: err instanceof ApiError ? err.message : t('common.error'), ok: false })
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
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.employeeName')}</span>
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Miguel Costa" />
        </label>
        <label className="min-w-48 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.employeeEmail')}</span>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="miguel@cafe.pt" />
        </label>
        <label className="min-w-40 flex-1">
          <span className="mb-1 block text-xs font-medium text-stone-500">{t('settings.employeePassword')}</span>
          <input className={input} type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('settings.employeePasswordHint')} />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
        >
          <UserPlus size={15} /> {t('settings.addEmployee')}
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
  const { t } = useTranslation()
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
      decor: store.decor,
      sales: store.sales,
      expenses: store.expenses,
      widgets: store.widgets,
      plan: store.plan,
      trialEndsAt: store.trialEndsAt,
    })
    setMessage({ text: t('settings.backupDownloaded'), ok: true })
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
        t('settings.restoreBackupConfirm', {
          salesCount: result.data.sales.length,
          lastDate: when.toLocaleDateString(),
          productsCount: result.data.products.length,
        })
      )
    ) {
      store.importData(result.data)
      setMessage({ text: t('settings.backupRestored'), ok: true })
    }
  }

  return (
    <Section title={t('settings.data')} hint={t('settings.dataHint')}>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          <Download size={15} /> {t('settings.exportBackup')}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <Upload size={15} /> {t('settings.importBackup')}
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
            if (window.confirm(t('settings.loadDemoConfirm'))) seedDemo()
          }}
          className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          {t('settings.loadDemo')}
        </button>
        <button
          onClick={() => {
            if (window.confirm(t('settings.clearDataConfirm'))) clearAllData()
          }}
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
        >
          {t('settings.clearData')}
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
  const { t } = useTranslation()
  return (
    <button
      onClick={() => {
        const name = window.prompt(t('settings.tableNameLabel'), nextName)
        if (!name?.trim()) return
        const seats = Number(window.prompt(t('settings.seatsLabel'), '4') ?? '4')
        onAdd(name.trim(), Number.isFinite(seats) && seats > 0 ? seats : 4)
      }}
      className="flex items-center gap-1 rounded-lg border border-dashed border-stone-300 px-2.5 py-1 text-sm text-stone-500 hover:border-stone-400 hover:text-stone-700"
    >
      <Plus size={13} /> {t('settings.addTable')}
    </button>
  )
}
