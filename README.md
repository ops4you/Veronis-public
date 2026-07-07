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

Everything is stored locally in the browser (`localStorage`) — no account, no server.
The app ships with a demo business (“Café Aurora”, ~12 weeks of realistic sales) so
every chart has something to say on first launch.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production web build in dist/
npm run app:build  # Windows installer (NSIS) in release/  — Veronis-Setup-<version>.exe
```

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
