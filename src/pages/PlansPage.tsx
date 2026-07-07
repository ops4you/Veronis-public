import { useState } from 'react'
import { BadgeCheck, Check, Crown, Sparkles } from 'lucide-react'
import { PLANS, effectivePlan, planName, trialDaysLeft, type PlanId } from '../lib/plans'
import { useStore } from '../store/useStore'
import { fmtMoney } from '../lib/format'

export function PlansPage() {
  const { plan, trialEndsAt, setPlan, settings } = useStore()
  const [annual, setAnnual] = useState(true)
  const effective = effectivePlan(plan, trialEndsAt)
  const daysLeft = trialDaysLeft(trialEndsAt)
  const trialActive = daysLeft > 0

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-stone-900">Plans</h1>
        <p className="mt-1 text-sm text-stone-500">Start small — upgrade the day you need more.</p>
        {trialActive && (
          <p className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-violet-50 px-4 py-1.5 text-sm font-medium text-violet-800">
            <Sparkles size={15} /> Premium trial active — {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left. Your plan:{' '}
            {planName(plan)}.
          </p>
        )}
      </header>

      <div className="mb-6 flex items-center justify-center gap-3 text-sm">
        <span className={annual ? 'text-stone-400' : 'font-medium text-stone-900'}>Monthly</span>
        <button
          role="switch"
          aria-checked={annual}
          onClick={() => setAnnual(!annual)}
          className={`relative h-6 w-11 rounded-full transition-colors ${annual ? 'bg-brand-600' : 'bg-stone-300'}`}
          aria-label="Bill annually"
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${annual ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
        <span className={annual ? 'font-medium text-stone-900' : 'text-stone-400'}>
          Annual <span className="text-green-700">(save ~20%)</span>
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = plan === p.id
          const price = annual ? p.annualMonthly : p.monthly
          return (
            <section
              key={p.id}
              className={`relative flex flex-col rounded-2xl border-2 bg-white p-5 shadow-card ${
                p.highlight ? 'border-brand-600' : 'border-stone-200'
              }`}
              aria-label={`${p.name} plan`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  Most popular
                </span>
              )}
              <div className="mb-1 flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-900">{p.name}</h2>
                {p.id === 'premium' && <Crown size={16} className="text-amber-500" />}
              </div>
              <p className="mb-4 text-xs text-stone-500">{p.tagline}</p>
              <div className="mb-4">
                <span className="text-3xl font-bold text-stone-900">{fmtMoney(price, settings.currency)}</span>
                <span className="text-sm text-stone-500"> /month</span>
                {annual && <span className="block text-xs text-stone-400">billed annually · VAT excl.</span>}
              </div>
              <ul className="mb-5 flex-1 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-stone-700">
                    <Check size={15} className="mt-0.5 shrink-0 text-green-600" /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <span className="flex items-center justify-center gap-1.5 rounded-xl bg-stone-100 px-4 py-2.5 text-sm font-semibold text-stone-600">
                  <BadgeCheck size={16} /> Current plan
                </span>
              ) : (
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Switch to the ${p.name} plan (${fmtMoney(price, settings.currency)}/month)?\n\nThis demo activates the plan immediately — in production this opens secure checkout.`,
                      )
                    )
                      setPlan(p.id as PlanId)
                  }}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                    p.highlight
                      ? 'bg-brand-600 text-white hover:bg-brand-700'
                      : 'border border-stone-300 text-stone-800 hover:bg-stone-50'
                  }`}
                >
                  Choose {p.name}
                </button>
              )}
            </section>
          )
        })}
      </div>

      <p className="mt-6 text-center text-xs text-stone-400">
        Currently active: <span className="font-medium text-stone-600">{planName(effective)}</span>
        {trialActive && ' (via trial)'} · Demo licensing — production uses server-side license validation and secure
        checkout. Cancel any time; your data always stays yours.
      </p>
    </div>
  )
}
