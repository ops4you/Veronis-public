/**
 * Veronis web server — auth, team management, and per-business state storage.
 *
 * Security posture:
 *  - Passwords hashed with bcrypt (cost 11), never logged or returned.
 *  - Sessions are signed JWTs in httpOnly SameSite=Lax cookies (no JS access).
 *  - Login is rate-limited per IP+email. Registration validates inputs.
 *  - Employees can only read/write their own business's data; role checks on
 *    every admin endpoint. State writes are size-capped and JSON-validated.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cookieParser from 'cookie-parser'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import Database from 'better-sqlite3'
import { sendMail, escapeHtml } from './mailer.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
fs.mkdirSync(DATA_DIR, { recursive: true })

// --- database -------------------------------------------------------------
const db = new Database(path.join(DATA_DIR, 'veronis.db'))
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin','employee')),
    pass_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS store_blobs (
    business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL,
    updated_by TEXT
  );
  CREATE TABLE IF NOT EXISTS auth_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('verify','reset','invite')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    created_at INTEGER NOT NULL
  );
`)

// Additive migrations for databases created by earlier versions.
{
  const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name)
  if (!cols.includes('email_verified'))
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0')
  if (!cols.includes('sessions_valid_after'))
    db.exec('ALTER TABLE users ADD COLUMN sessions_valid_after INTEGER NOT NULL DEFAULT 0')
}

// --- session secret (generated once, kept out of the repo) -----------------
const SECRET_FILE = path.join(DATA_DIR, 'session-secret')
if (!fs.existsSync(SECRET_FILE)) fs.writeFileSync(SECRET_FILE, crypto.randomBytes(48).toString('hex'))
const JWT_SECRET = process.env.JWT_SECRET || fs.readFileSync(SECRET_FILE, 'utf8').trim()

const PORT = Number(process.env.PORT || 8787)
const IS_PROD = process.env.NODE_ENV === 'production'
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, '')
const COOKIE = 'veronis_session'
const SESSION_DAYS = 7
const MAX_STATE_BYTES = 15 * 1024 * 1024

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: `${MAX_STATE_BYTES}b` }))
app.use(cookieParser())

// Conservative security headers on everything we serve.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})

// --- helpers ----------------------------------------------------------------
const now = () => Date.now()
const uid = () => crypto.randomUUID()
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function setSession(res, user) {
  const token = jwt.sign(
    { sub: user.id, biz: user.business_id, role: user.role },
    JWT_SECRET,
    { expiresIn: `${SESSION_DAYS}d` },
  )
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: SESSION_DAYS * 86_400_000,
  })
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE]
  if (!token) return res.status(401).json({ error: 'Not signed in.' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = db
      .prepare('SELECT id, business_id, email, name, role, email_verified, sessions_valid_after FROM users WHERE id = ?')
      .get(payload.sub)
    if (!user) return res.status(401).json({ error: 'Account no longer exists.' })
    // Sessions issued before the last password change are void.
    if (payload.iat && payload.iat * 1000 < user.sessions_valid_after)
      return res.status(401).json({ error: 'Session expired — sign in again.' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ error: 'Session expired — sign in again.' })
  }
}

// --- one-time tokens (verification, reset, invites) --------------------------
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

function issueToken(userId, kind, ttlMs) {
  const raw = crypto.randomBytes(32).toString('base64url')
  db.prepare('INSERT INTO auth_tokens (id, user_id, kind, token_hash, expires_at, used_at, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)')
    .run(uid(), userId, kind, sha256(raw), now() + ttlMs, now())
  return raw
}

/** Validates and burns a token. Returns the user id, or null. */
function consumeToken(raw, kinds) {
  if (typeof raw !== 'string' || raw.length < 20) return null
  const row = db
    .prepare(
      `SELECT id, user_id, kind FROM auth_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    )
    .get(sha256(raw), now())
  if (!row || !kinds.includes(row.kind)) return null
  db.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ?').run(now(), row.id)
  return row.user_id
}

function sendVerificationEmail(user) {
  const token = issueToken(user.id, 'verify', 24 * 3_600_000)
  return sendMail({
    to: user.email,
    subject: 'Confirm your email — Veronis',
    heading: `Welcome, ${user.name}!`,
    bodyHtml: `<p style="color:#57534e;line-height:1.6">One click and your Veronis account is confirmed.</p>`,
    actionUrl: `${APP_URL}/api/auth/verify?token=${token}`,
    actionLabel: 'Confirm my email',
  })
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' })
  next()
}

// Simple in-memory login rate limit: 10 attempts / 15 min per IP+email.
const attempts = new Map()
function rateLimited(key) {
  const rec = attempts.get(key)
  if (rec && rec.until > now()) return true
  return false
}
function noteFailure(key) {
  const rec = attempts.get(key) ?? { count: 0, until: 0 }
  rec.count += 1
  if (rec.count >= 10) {
    rec.until = now() + 15 * 60_000
    rec.count = 0
  }
  attempts.set(key, rec)
}

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  emailVerified: Boolean(u.email_verified),
})

// --- auth -------------------------------------------------------------------
app.post('/api/auth/register', (req, res) => {
  const { businessName, name, email, password } = req.body ?? {}
  if (typeof businessName !== 'string' || businessName.trim().length < 2)
    return res.status(400).json({ error: 'Give your business a name (at least 2 characters).' })
  if (typeof name !== 'string' || name.trim().length < 2)
    return res.status(400).json({ error: 'Tell us your name.' })
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim().toLowerCase()))
    return res.status(400).json({ error: 'That email address does not look valid.' })
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })

  const cleanEmail = email.trim().toLowerCase()
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanEmail))
    return res.status(409).json({ error: 'An account with this email already exists.' })

  const businessId = uid()
  const userId = uid()
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO businesses (id, name, created_at) VALUES (?, ?, ?)').run(
      businessId,
      businessName.trim(),
      now(),
    )
    db.prepare(
      'INSERT INTO users (id, business_id, email, name, role, pass_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(userId, businessId, cleanEmail, name.trim(), 'admin', bcrypt.hashSync(password, 11), now())
  })
  tx()

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId)
  setSession(res, user)
  void sendVerificationEmail(user).catch((err) => console.error('[mail] verification failed:', err.message))
  res.json({ user: publicUser(user), businessName: businessName.trim() })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body ?? {}
  if (typeof email !== 'string' || typeof password !== 'string')
    return res.status(400).json({ error: 'Email and password are required.' })
  const cleanEmail = email.trim().toLowerCase()
  const key = `${req.ip}|${cleanEmail}`
  if (rateLimited(key))
    return res.status(429).json({ error: 'Too many attempts — try again in 15 minutes.' })

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail)
  if (!user || !bcrypt.compareSync(password, user.pass_hash)) {
    noteFailure(key)
    return res.status(401).json({ error: 'Wrong email or password.' })
  }
  attempts.delete(key)
  setSession(res, user)
  const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(user.business_id)
  res.json({ user: publicUser(user), businessName: biz?.name ?? '' })
})

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE)
  res.json({ ok: true })
})

// Email-confirmation link target. Redirects into the app either way.
app.get('/api/auth/verify', (req, res) => {
  const userId = consumeToken(String(req.query.token ?? ''), ['verify'])
  if (userId) db.prepare('UPDATE users SET email_verified = 1 WHERE id = ?').run(userId)
  res.redirect(`/?verified=${userId ? '1' : '0'}`)
})

app.post('/api/auth/resend-verification', requireAuth, (req, res) => {
  if (req.user.email_verified) return res.status(400).json({ error: 'Your email is already confirmed.' })
  const key = `resend|${req.user.id}`
  if (rateLimited(key)) return res.status(429).json({ error: 'Too many emails sent — try again later.' })
  noteFailure(key)
  void sendVerificationEmail(req.user).catch((err) => console.error('[mail] verification failed:', err.message))
  res.json({ ok: true })
})

app.post('/api/auth/forgot', (req, res) => {
  const { email } = req.body ?? {}
  const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  // Same response whether or not the account exists — no account enumeration.
  const reply = () => res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' })
  if (!EMAIL_RE.test(cleanEmail)) return reply()
  const key = `forgot|${cleanEmail}`
  if (rateLimited(key)) return reply()
  noteFailure(key)
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(cleanEmail)
  if (user) {
    const token = issueToken(user.id, 'reset', 3_600_000) // 1 hour
    void sendMail({
      to: user.email,
      subject: 'Reset your password — Veronis',
      heading: 'Reset your password',
      bodyHtml: `<p style="color:#57534e;line-height:1.6">Someone (hopefully you) asked to reset the password for ${escapeHtml(user.email)}. The link works once and expires in 1 hour.</p>`,
      actionUrl: `${APP_URL}/#/reset?token=${token}`,
      actionLabel: 'Choose a new password',
    }).catch((err) => console.error('[mail] reset failed:', err.message))
  }
  reply()
})

app.post('/api/auth/reset', (req, res) => {
  const { token, password } = req.body ?? {}
  if (typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' })
  const userId = consumeToken(token, ['reset', 'invite'])
  if (!userId) return res.status(400).json({ error: 'This link is invalid or has expired — request a new one.' })
  // Proving control of the inbox also confirms the email address.
  db.prepare('UPDATE users SET pass_hash = ?, sessions_valid_after = ?, email_verified = 1 WHERE id = ?').run(
    bcrypt.hashSync(password, 11),
    now(),
    userId,
  )
  res.json({ ok: true })
})

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { current, next } = req.body ?? {}
  if (typeof next !== 'string' || next.length < 8)
    return res.status(400).json({ error: 'The new password must be at least 8 characters.' })
  const row = db.prepare('SELECT pass_hash FROM users WHERE id = ?').get(req.user.id)
  if (typeof current !== 'string' || !bcrypt.compareSync(current, row.pass_hash))
    return res.status(401).json({ error: 'Your current password is wrong.' })
  db.prepare('UPDATE users SET pass_hash = ?, sessions_valid_after = ? WHERE id = ?').run(
    bcrypt.hashSync(next, 11),
    now(),
    req.user.id,
  )
  // Other devices are signed out; this one gets a fresh session.
  setSession(res, req.user)
  res.json({ ok: true })
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.user.business_id)
  res.json({ user: publicUser(req.user), businessName: biz?.name ?? '' })
})

// --- team management ----------------------------------------------------------
app.get('/api/users', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    const rows = db
      .prepare('SELECT id, email, name, role, created_at FROM users WHERE business_id = ? ORDER BY created_at')
      .all(req.user.business_id)
    return res.json({ users: rows })
  }
  // Employees see names only (for the "served by" switcher) — no emails.
  const rows = db
    .prepare('SELECT id, name, role FROM users WHERE business_id = ? ORDER BY created_at')
    .all(req.user.business_id)
  res.json({ users: rows })
})

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { name, email, password } = req.body ?? {}
  if (typeof name !== 'string' || name.trim().length < 2)
    return res.status(400).json({ error: 'Give the employee a name.' })
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim().toLowerCase()))
    return res.status(400).json({ error: 'That email address does not look valid.' })
  const hasPassword = typeof password === 'string' && password.length > 0
  if (hasPassword && password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters (or leave it empty to email an invite).' })
  const cleanEmail = email.trim().toLowerCase()
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(cleanEmail))
    return res.status(409).json({ error: 'An account with this email already exists.' })

  const id = uid()
  // Without a password: an unusable random hash until the invite link is used.
  const hash = bcrypt.hashSync(hasPassword ? password : crypto.randomBytes(32).toString('hex'), 11)
  db.prepare(
    'INSERT INTO users (id, business_id, email, name, role, pass_hash, email_verified, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, req.user.business_id, cleanEmail, name.trim(), 'employee', hash, hasPassword ? 1 : 0, now())

  if (!hasPassword) {
    const token = issueToken(id, 'invite', 48 * 3_600_000)
    const biz = db.prepare('SELECT name FROM businesses WHERE id = ?').get(req.user.business_id)
    void sendMail({
      to: cleanEmail,
      subject: `You're invited to ${biz?.name ?? 'Veronis'}`,
      heading: `${req.user.name} added you to ${biz?.name ?? 'the team'}`,
      bodyHtml: `<p style="color:#57534e;line-height:1.6">Choose a password and you're in. You'll use ${escapeHtml(cleanEmail)} to sign in. The link works once and expires in 48 hours.</p>`,
      actionUrl: `${APP_URL}/#/reset?token=${token}`,
      actionLabel: 'Choose my password',
    }).catch((err) => console.error('[mail] invite failed:', err.message))
  }

  res.json({ user: { id, email: cleanEmail, name: name.trim(), role: 'employee' }, invited: !hasPassword })
})

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const target = db
    .prepare('SELECT id, role, business_id FROM users WHERE id = ? AND business_id = ?')
    .get(req.params.id, req.user.business_id)
  if (!target) return res.status(404).json({ error: 'No such employee.' })
  if (target.role !== 'employee') return res.status(400).json({ error: 'Admins cannot be removed here.' })
  db.prepare('DELETE FROM users WHERE id = ?').run(target.id)
  res.json({ ok: true })
})

// --- business state ------------------------------------------------------------
app.get('/api/state', requireAuth, (req, res) => {
  const row = db.prepare('SELECT data, version FROM store_blobs WHERE business_id = ?').get(req.user.business_id)
  res.json({ data: row?.data ?? null, version: row?.version ?? 0 })
})

app.put('/api/state', requireAuth, (req, res) => {
  const { data } = req.body ?? {}
  if (typeof data !== 'string') return res.status(400).json({ error: 'Missing state payload.' })
  if (Buffer.byteLength(data, 'utf8') > MAX_STATE_BYTES)
    return res.status(413).json({ error: 'State too large.' })
  try {
    JSON.parse(data)
  } catch {
    return res.status(400).json({ error: 'State is not valid JSON.' })
  }
  const existing = db.prepare('SELECT version FROM store_blobs WHERE business_id = ?').get(req.user.business_id)
  if (existing) {
    db.prepare('UPDATE store_blobs SET data = ?, version = version + 1, updated_at = ?, updated_by = ? WHERE business_id = ?')
      .run(data, now(), req.user.id, req.user.business_id)
  } else {
    db.prepare('INSERT INTO store_blobs (business_id, data, version, updated_at, updated_by) VALUES (?, ?, 1, ?, ?)')
      .run(req.user.business_id, data, now(), req.user.id)
  }
  const v = db.prepare('SELECT version FROM store_blobs WHERE business_id = ?').get(req.user.business_id)
  res.json({ ok: true, version: v.version })
})

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'veronis', time: now() }))

// --- static web app -------------------------------------------------------------
const DIST = path.join(__dirname, '..', 'dist')
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(DIST, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Veronis server listening on http://localhost:${PORT} (${IS_PROD ? 'production' : 'development'})`)
})
