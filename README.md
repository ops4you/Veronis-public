# Veronis

**Run your place, simply.** A lightweight point-of-sale + analytics app for small and
medium hospitality businesses — cafés, pastry shops, bars. Think of it as the simple,
fully-customisable alternative to heavyweight ERP suites: no training manual needed.

## What it does

- **Dashboard** — a grid of widgets the owner composes: income, expenses, profit,
  orders, average ticket, sales per day, top products, category mix, payment split,
  latest sales, and **Quiet hours** — a week×hour heatmap that spots the hours and
  days with no clients, so you know when to close earlier or run a lighter shift.
  Every widget can be recoloured, resized (narrow/wide), reordered and removed.
- **Service** — the day-to-day tool: rooms and tables (laid out by you in Settings),
  tap a table → tap products → **send the ticket to the kitchen** → **charge** with a
  printable bill. Counter/takeaway sales too.
- **Kitchen** — a live ticket queue with elapsed-time badges. Open it in a second
  browser window/screen; it syncs across tabs automatically.
- **Menu** — categories, products, prices, on-sale toggles.
- **History** — sales grouped by day plus a simple expense ledger.
- **Settings** — business name, currency, opening days/hours (feeds the quiet-hours
  analysis), rooms & tables editor, demo data / full reset.

Everything is stored locally in **IndexedDB** — no account, no server, works fully
offline (data from older localStorage versions migrates automatically, keeping a
safety copy). Settings has one-click **backup export/import** (versioned, validated
JSON), and a crash screen can always rescue the data. The app ships with a demo
business (“Café Aurora”, ~12 weeks of realistic sales) so every chart has something
to say on first launch.

### Grocery mode

Products can be sold **per item or by weight (€/kg)** and carry a **barcode**.
USB barcode scanners (keyboard-wedge) work out of the box on the Service page —
including supermarket-style weight-embedded labels (`2` + item ref + grams +
check digit) printed by label scales, so weighing fruit needs no scale
integration at the till. Unknown codes and scans are confirmed on screen.

## Run it

**Web app (multi-user, accounts):**

```bash
npm install && npm run build      # build the front-end
cd server && npm install          # server deps (Express + SQLite)
node index.mjs                    # → http://localhost:8787
```

The first visitor clicks "Create business" to register the admin account
(email + password, with email confirmation). Admins add employees in
Settings → Team — either with a password, or by leaving it empty to send an
**email invite** where the employee picks their own. Forgot-password and
change-password are built in. Deploy anywhere Node runs (a €5 VPS is plenty);
put a TLS reverse proxy (Caddy/nginx) in front and set `NODE_ENV=production`.

**Email**: set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (or one
`SMTP_URL`), `MAIL_FROM`, and `APP_URL` (the public URL used in email links).
Without SMTP configured, emails are written to `server/data/outbox/` so every
flow works in development.

**Development:**

```bash
npm run dev        # http://localhost:5173 (proxies /api to :8787)
npm run test       # unit/integration test suite (Vitest, 74 tests)
npm run app:build  # Windows installer (NSIS) — Veronis-Setup-<version>.exe
```

## Accounts & roles

- **Admin** — the business owner: full dashboard, menu, history, plans,
  settings, and Settings → Team to create/remove employee accounts.
- **Employee** — signs in with their own email+password: Service, Kitchen and a
  personal **"My sales"** dashboard (revenue, orders served, average ticket,
  sales over time). Every order carries a *Served by* field (defaults to the
  signed-in user, switchable on the ticket), so the admin's **Sales by
  employee** widget shows exactly who sold what.
- The **desktop .exe** runs in single-user local mode (no accounts, fully
  offline) — same codebase, mode detected automatically.

The installer is a self-contained desktop app (hardened Electron shell, fully
offline). Hand the `Veronis-Setup-*.exe` to any Windows machine to showcase.
It is not yet code-signed, so SmartScreen will ask for "More info → Run anyway".

## Plans

Three subscription tiers are built in (Basic €14.90 / Standard €29.90 / Premium
€49.90 per month, ~20% off annually) with feature gating: rooms/tables and history
limits on Basic, chart widgets from Standard, quiet-hours intelligence on Premium.
Every fresh install starts a 14-day Premium trial. Activation is currently local
(demo licensing) — production requires a licence server (see SECURITY.md).

## Security

See [SECURITY.md](SECURITY.md) — sandboxed renderer, strict CSP, zero runtime
network calls, denied permissions, audit-clean runtime dependencies.

## Stack

Vite 5 · React 18 · TypeScript · Tailwind CSS 3 · Zustand (persisted) ·
React Router (hash) · Lucide icons · hand-rolled SVG charts.

## Roadmap ideas

- Multi-device sync via a small backend (the store layer is already centralised)
- Dark mode, drag-and-drop widget reordering
- Staff accounts / roles, shift reports
- Export (CSV) and printable daily summaries
- i18n (PT/EN)
