import { NavLink } from 'react-router-dom'
import {
  BookOpen,
  ChefHat,
  Crown,
  HandPlatter,
  History,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { effectivePlan, planName, trialDaysLeft } from '../../lib/plans'

const LINKS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/service', label: 'Service', icon: HandPlatter },
  { to: '/kitchen', label: 'Kitchen', icon: ChefHat },
  { to: '/menu', label: 'Menu', icon: BookOpen },
  { to: '/history', label: 'History', icon: History },
  { to: '/plans', label: 'Plans', icon: Crown },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const kitchenCount = useStore((s) => s.orders.filter((o) => o.status === 'sent' || o.status === 'ready').length)
  const plan = useStore((s) => s.plan)
  const trialEndsAt = useStore((s) => s.trialEndsAt)
  const daysLeft = trialDaysLeft(trialEndsAt)

  return (
    <nav
      className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-stone-200 bg-white lg:w-56"
      aria-label="Main navigation"
    >
      <div className="flex items-center gap-2.5 px-3 py-5 lg:px-5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-lg font-extrabold text-white">
          V
        </span>
        <span className="hidden text-lg font-bold tracking-tight text-stone-900 lg:block">Veronis</span>
      </div>
      <ul className="flex-1 space-y-1 px-2 lg:px-3">
        {LINKS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                }`
              }
            >
              <Icon size={19} className="shrink-0" />
              <span className="hidden lg:block">{label}</span>
              {label === 'Kitchen' && kitchenCount > 0 && (
                <span
                  className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white lg:static lg:ml-auto"
                  aria-label={`${kitchenCount} open kitchen tickets`}
                >
                  {kitchenCount}
                </span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="hidden px-3 pb-4 lg:block">
        <NavLink
          to="/plans"
          className="block rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 hover:border-stone-300"
        >
          {daysLeft > 0 ? (
            <>
              <span className="block text-xs font-semibold text-violet-700">Premium trial · {daysLeft}d left</span>
              <span className="block text-[11px] text-stone-500">then {planName(effectivePlan(plan, null))} — see plans</span>
            </>
          ) : (
            <>
              <span className="block text-xs font-semibold text-stone-700">{planName(plan)} plan</span>
              <span className="block text-[11px] text-stone-500">upgrade or change</span>
            </>
          )}
        </NavLink>
        <p className="mt-3 px-1 text-[11px] text-stone-400">Veronis · run your place, simply</p>
      </div>
    </nav>
  )
}
