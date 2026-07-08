import { useEffect, useState, type ReactNode } from 'react'
import { api, ApiError, type SessionUser } from '../lib/api'
import { isLocalMode } from '../lib/mode'
import { flushPendingState } from '../lib/remoteStorage'
import { useStore } from '../store/useStore'
import { AuthContext } from './AuthContext'

type Phase = 'checking' | 'unauthenticated' | 'ready'

/**
 * Server mode: blocks the app behind email+password sign-in and hydrates the
 * business state only after the session is confirmed.
 * Local (desktop) mode: renders straight through.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(isLocalMode ? 'ready' : 'checking')
  const [user, setUser] = useState<SessionUser | null>(null)
  const [businessName, setBusinessName] = useState<string | null>(null)

  const enter = async (u: SessionUser, biz: string) => {
    setUser(u)
    setBusinessName(biz)
    await useStore.persist.rehydrate()
    if (biz) useStore.getState().updateSettings({ businessName: biz })
    setPhase('ready')
  }

  useEffect(() => {
    if (isLocalMode) return
    api
      .me()
      .then(({ user: u, businessName: biz }) => enter(u, biz))
      .catch(() => setPhase('unauthenticated'))
  }, [])

  if (isLocalMode) {
    return <AuthContext.Provider value={{ user: null, businessName: null, isAdmin: true, logout: async () => {} }}>{children}</AuthContext.Provider>
  }

  if (phase === 'checking') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page">
        <p className="text-sm text-stone-400">Checking your session…</p>
      </div>
    )
  }

  if (phase === 'unauthenticated') {
    return <AuthScreen onAuthed={enter} />
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        businessName,
        isAdmin: user?.role === 'admin',
        logout: async () => {
          await flushPendingState()
          await api.logout().catch(() => {})
          window.location.reload()
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------

/** Reads a one-time reset/invite token from '#/reset?token=…'. */
function tokenFromHash(): string | null {
  const m = window.location.hash.match(/^#\/reset\?token=([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

function AuthScreen({ onAuthed }: { onAuthed: (u: SessionUser, biz: string) => Promise<void> }) {
  const [tab, setTab] = useState<'login' | 'register' | 'forgot' | 'reset'>(() =>
    tokenFromHash() ? 'reset' : 'login',
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('verified') === '1') return 'Email confirmed — you can sign in.'
    if (params.get('verified') === '0') return 'That confirmation link is invalid or expired.'
    return null
  })

  useEffect(() => {
    // Clean ?verified=… so the notice doesn't reappear on every reload.
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  }, [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [name, setName] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (tab === 'forgot') {
        const { message } = await api.forgotPassword(email)
        setNotice(message)
        setTab('login')
        setBusy(false)
        return
      }
      if (tab === 'reset') {
        const token = tokenFromHash()
        if (!token) throw new ApiError(400, 'This reset link is incomplete — use the link from the email.')
        await api.resetPassword(token, password)
        window.location.hash = '#/'
        setNotice('Password set — sign in with it now.')
        setPassword('')
        setTab('login')
        setBusy(false)
        return
      }
      const result =
        tab === 'login'
          ? await api.login(email, password)
          : await api.register(businessName, name, email, password)
      await onAuthed(result.user, result.businessName)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server — check your connection.')
      setBusy(false)
    }
  }

  const input =
    'w-full rounded-xl border border-stone-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none'

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-extrabold text-white">
            V
          </span>
          <h1 className="text-xl font-bold text-stone-900">Veronis</h1>
          <p className="text-sm text-stone-500">Run your place, simply</p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-card">
          {(tab === 'login' || tab === 'register') && (
            <div className="mb-4 flex rounded-xl border border-stone-200 p-0.5">
              {(['login', 'register'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t)
                    setError(null)
                  }}
                  className={`flex-1 rounded-[10px] px-3 py-1.5 text-sm font-medium ${
                    tab === t ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {t === 'login' ? 'Sign in' : 'Create business'}
                </button>
              ))}
            </div>
          )}
          {tab === 'forgot' && (
            <p className="mb-4 text-sm text-stone-600">
              Enter your account email and we'll send a link to choose a new password.
            </p>
          )}
          {tab === 'reset' && (
            <p className="mb-4 text-sm text-stone-600">Choose your new password.</p>
          )}

          {notice && (
            <p role="status" className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              {notice}
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            {tab === 'register' && (
              <>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Business name</span>
                  <input className={input} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Café Aurora" autoFocus />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-stone-700">Your name</span>
                  <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ana Silva" autoComplete="name" />
                </label>
              </>
            )}
            {tab !== 'reset' && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">Email</span>
                <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" autoFocus={tab === 'login'} />
              </label>
            )}
            {tab !== 'forgot' && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-stone-700">
                  {tab === 'reset' ? 'New password' : 'Password'}
                </span>
                <input
                  className={input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={tab === 'login' ? '••••••••' : 'At least 8 characters'}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  autoFocus={tab === 'reset'}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy
                ? 'One moment…'
                : tab === 'login'
                  ? 'Sign in'
                  : tab === 'register'
                    ? 'Create my business'
                    : tab === 'forgot'
                      ? 'Email me a reset link'
                      : 'Set new password'}
            </button>
          </form>

          {tab === 'login' && (
            <button
              onClick={() => {
                setTab('forgot')
                setError(null)
                setNotice(null)
              }}
              className="mt-3 w-full text-center text-sm font-medium text-brand-600 hover:underline"
            >
              Forgot your password?
            </button>
          )}
          {(tab === 'forgot' || tab === 'reset') && (
            <button
              onClick={() => {
                setTab('login')
                setError(null)
              }}
              className="mt-3 w-full text-center text-sm text-stone-500 hover:underline"
            >
              Back to sign in
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-stone-400">
          Your team signs in with accounts you create in Settings → Team.
        </p>
      </div>
    </div>
  )
}
