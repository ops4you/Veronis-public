import { Component, type ReactNode } from 'react'
import { downloadBackupFile } from '../../lib/backup'
import { useStore } from '../../store/useStore'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last line of defence: a rendering bug must never take the till down or lose
 * data. Shows a recovery screen with a one-click backup of everything in the
 * store, plus reload.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  private saveBackup = () => {
    try {
      const s = useStore.getState()
      downloadBackupFile({
        settings: s.settings,
        categories: s.categories,
        products: s.products,
        rooms: s.rooms,
        tables: s.tables,
        sales: s.sales,
        expenses: s.expenses,
        widgets: s.widgets,
        plan: s.plan,
        trialEndsAt: s.trialEndsAt,
      })
    } catch {
      window.alert('Could not build the backup automatically. Your data is still stored on this machine.')
    }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page p-6">
        <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-card">
          <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-2xl">
            ⚠️
          </span>
          <h1 className="mb-1 text-lg font-bold text-stone-900">Something went wrong</h1>
          <p className="mb-5 text-sm text-stone-500">
            The screen hit an unexpected error. Your data is safe on this machine — you can download a backup
            right now, then reload.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={this.saveBackup}
              className="rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Download backup
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Reload app
            </button>
          </div>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-stone-400">Technical details</summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-stone-50 p-2 text-[11px] text-stone-600">
              {String(this.state.error?.stack ?? this.state.error)}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
