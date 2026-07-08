import { useEffect, useState, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { Sidebar } from './components/layout/Sidebar'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { DashboardPage } from './pages/DashboardPage'
import { PosPage } from './pages/PosPage'
import { KitchenPage } from './pages/KitchenPage'
import { MenuPage } from './pages/MenuPage'
import { HistoryPage } from './pages/HistoryPage'
import { PlansPage } from './pages/PlansPage'
import { SettingsPage } from './pages/SettingsPage'
import { useStore } from './store/useStore'
import { AuthGate } from './auth/AuthGate'
import { api } from './lib/api'
import { MailWarning } from 'lucide-react'

/** Storage is async (IndexedDB / server) — hold rendering until data is loaded. */
function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated())
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true))
    if (useStore.persist.hasHydrated()) setHydrated(true)
    return unsub
  }, [])
  return hydrated
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthGate>
        <HydratedApp />
      </AuthGate>
    </ErrorBoundary>
  )
}

function VerifyEmailBanner() {
  const { user } = useAuth()
  const [state, setState] = useState<'idle' | 'sent' | 'dismissed'>('idle')
  if (!user || user.emailVerified || state === 'dismissed') return null
  return (
    <div className="mx-auto mb-4 flex max-w-7xl flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <MailWarning size={16} className="shrink-0" />
      <span className="min-w-0 flex-1">
        Confirm your email — we sent a link to <span className="font-semibold">{user.email}</span>.
      </span>
      {state === 'sent' ? (
        <span className="font-medium">Sent again — check your inbox.</span>
      ) : (
        <button
          onClick={() => {
            void api.resendVerification().then(() => setState('sent')).catch(() => setState('sent'))
          }}
          className="font-semibold text-amber-900 underline hover:no-underline"
        >
          Resend email
        </button>
      )}
      <button onClick={() => setState('dismissed')} className="ml-1 text-amber-700 hover:text-amber-900" aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function HydratedApp() {
  const hydrated = useHydrated()

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page">
        <div className="text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-2xl font-extrabold text-white">
            V
          </span>
          <p className="text-sm text-stone-400">Loading your business…</p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <div className="min-h-dvh bg-page text-stone-900">
        <Sidebar />
        <main className="ml-16 min-h-dvh p-4 sm:p-6 lg:ml-56 lg:p-8">
          <VerifyEmailBanner />
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/service" element={<PosPage />} />
            <Route path="/kitchen" element={<KitchenPage />} />
            <Route path="/menu" element={<AdminRoute><MenuPage /></AdminRoute>} />
            <Route path="/history" element={<AdminRoute><HistoryPage /></AdminRoute>} />
            <Route path="/plans" element={<AdminRoute><PlansPage /></AdminRoute>} />
            <Route path="/settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  )
}
