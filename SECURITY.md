# Veronis — Security posture

_Last reviewed: 2026-07-07 (v0.2.0)_

## Threat model

Veronis v0.2 is an offline desktop app. Business data (sales, menu, tables,
expenses) lives only on the machine it runs on — there is no account, no server,
and **zero network calls at runtime**. The main assets to protect are the local
business data and the integrity of the app itself.

## Web deployment (v0.4+): auth & server

- Passwords hashed with bcrypt (cost 11); never logged, never returned.
- Sessions: signed JWT in an httpOnly SameSite=Lax cookie (`secure` in
  production) — no tokens in JavaScript-readable storage.
- **Email verification** on signup (24 h link, resendable, in-app banner until
  confirmed). **Password reset** by email (1 h link) and **employee invites**
  (48 h link, employee chooses their own password — admins never know it).
- One-time tokens are 256-bit random values stored **hashed** (SHA-256),
  single-use, expiring; the forgot-password endpoint gives the same response
  whether or not the account exists (no account enumeration) and is
  rate-limited per email.
- Changing or resetting a password bumps `sessions_valid_after`, revoking all
  other sessions immediately.
- Email delivery via any SMTP provider (`SMTP_HOST/PORT/USER/PASS` or
  `SMTP_URL`, plus `MAIL_FROM` and `APP_URL` for links). With no SMTP
  configured (development), emails are written to `server/data/outbox/` and
  logged — flows stay testable without leaking tokens through API responses.
- Login rate-limited (10 attempts / 15 min per IP+email). Input validation on
  every endpoint; parameterised SQL throughout (better-sqlite3).
- Role enforcement server-side: employee sessions cannot create/remove
  accounts or read other users' emails; every data endpoint is scoped to the
  session's business id.
- State writes are size-capped and JSON-validated. Security headers
  (nosniff, frame deny, no-referrer) on all responses.
- Deploy behind TLS (Caddy/nginx) with `NODE_ENV=production` set.
- Known gap for later: business state is stored as one blob per business —
  concurrent writes are last-write-wins (fine for one till + read-mostly
  dashboards; the SQL-normalised schema removes this).

## Hardening in place

**Desktop shell (Electron 43, current stable — all published Electron advisories
as of this date are fixed):**

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false` — the UI runs
  as an untrusted, sandboxed web page with no access to Node.js or the filesystem.
- No preload script, no IPC surface — nothing for a compromised renderer to call.
- All permission requests (camera, mic, geolocation, …) are denied.
- Popups are denied; any navigation away from the bundled `file://` app is blocked.
- Application menu removed; DevTools disabled in packaged builds.
- Single-instance lock.

**Web layer:**

- Strict Content-Security-Policy on production builds:
  `default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; …`
  — no remote scripts, styles, fonts or connections can ever load.
- No external assets at all (system font stack; SVG icons bundled).
- React's default output encoding everywhere; no `dangerouslySetInnerHTML`, no `eval`.
- All user input is treated as data, rendered escaped, and parsed with strict
  number validation where numeric.
- Imported backup files are structurally validated field-by-field before being
  applied; unknown plan values are downgraded, malformed records are rejected.
- Scanned barcodes are validated (EAN-13 check digit for weight-embedded labels)
  and treated as lookups only — a scan can never inject data.

**Testing:**

- 70 automated tests (Vitest) cover the analytics engine (including the
  quiet-hours algorithm), order lifecycle, payments, plan gating, barcode
  parsing/scanner input, and backup validation. Run with `npm test`.

**Supply chain:**

- `npm audit` run on every dependency change. Current state:
  - Runtime/shipped code: **0 known vulnerabilities** (Electron upgraded 32 → 43).
  - Remaining advisories are confined to build/dev tooling that is never shipped:
    `electron-builder`'s `tar` chain (build-time archive extraction of TLS-fetched,
    pinned toolchain downloads) and Vite/esbuild's dev server (development only,
    binds to localhost). Both are fixed by their next majors, which require
    Node ≥ 20 — see "Recommended next steps".

## Known limitations (deliberate, documented)

1. **Tier gating is client-side.** Fine for demos; before charging customers,
   plan activation must be validated by a licence server (signed licence tokens,
   short-lived, verified in the main process).
2. **The installer is not code-signed.** Windows SmartScreen will warn on fresh
   machines. Buy an OV/EV code-signing certificate before wide distribution and
   sign both the installer and the app binary.
3. **Local data is not encrypted at rest.** IndexedDB under the OS user profile
   inherits OS user-account protection only. Mitigations in place: versioned,
   validated backup export/import; schema migrations that never drop data; a
   crash screen that can always export a backup. Roadmap: optional encrypted
   backups and, with cloud sync, end-to-end encryption of business data.
4. **Bills are not fiscal documents.** Portuguese law requires AT-certified
   invoicing software (SAF-T PT, ATCUD, QR). Do not present printed bills as
   invoices until certification/integration is in place.
5. **No auto-update channel yet.** When added, use electron-updater with signed
   releases only.

## Recommended next steps (ordered)

1. Upgrade the dev machine to Node 22 LTS (Node 18 is end-of-life) — this also
   unlocks electron-builder 26 and Vite 7+, clearing the remaining tooling audits.
2. Code-signing certificate; sign installer + binary; enable SmartScreen reputation.
3. Licence server + server-validated plan activation (before first paid customer).
4. CI pipeline: typecheck, `npm audit --omit=dev` gate, build, sign.
5. AT-certified invoicing integration (legal requirement in Portugal).
6. Optional encrypted backup/export; per-employee PIN roles.

## Reporting

Found something? Open an issue marked `security` or contact the maintainer
privately. Please do not publish exploits before a fix ships.
