/**
 * Outgoing email. Two transports:
 *  - SMTP (production): configure SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS
 *    (or a full SMTP_URL) and MAIL_FROM. Works with Brevo, Resend, Postmark,
 *    SES, or any provider that speaks SMTP.
 *  - Outbox (development, no SMTP configured): each email is written to
 *    server/data/outbox/*.html and the action link is printed to the server
 *    log, so every flow is testable without an email account.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import nodemailer from 'nodemailer'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTBOX = path.join(__dirname, 'data', 'outbox')

const FROM = process.env.MAIL_FROM || 'Veronis <no-reply@veronis.local>'

function smtpConfigured() {
  return Boolean(process.env.SMTP_URL || process.env.SMTP_HOST)
}

let transport = null
function getTransport() {
  if (!transport) {
    transport = process.env.SMTP_URL
      ? nodemailer.createTransport(process.env.SMTP_URL)
      : nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: process.env.SMTP_SECURE === 'true',
          auth: process.env.SMTP_USER
            ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
            : undefined,
        })
  }
  return transport
}

export async function sendMail({ to, subject, heading, bodyHtml, actionUrl, actionLabel }) {
  const html = renderEmail({ heading, bodyHtml, actionUrl, actionLabel })
  if (smtpConfigured()) {
    await getTransport().sendMail({ from: FROM, to, subject, html })
    return { delivered: 'smtp' }
  }
  // Dev outbox: never lose the email, never silently succeed.
  fs.mkdirSync(OUTBOX, { recursive: true })
  const file = path.join(OUTBOX, `${Date.now()}-${to.replace(/[^a-z0-9@.]/gi, '_')}.html`)
  fs.writeFileSync(file, `<!-- to: ${to} | subject: ${subject} -->\n${html}`)
  console.log(`[mail:outbox] to=${to} subject="${subject}"${actionUrl ? ` link=${actionUrl}` : ''}`)
  return { delivered: 'outbox', file }
}

function renderEmail({ heading, bodyHtml, actionUrl, actionLabel }) {
  const button = actionUrl
    ? `<p style="margin:28px 0"><a href="${actionUrl}" style="background:#c2410c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:12px;font-weight:600;display:inline-block">${actionLabel}</a></p>
       <p style="font-size:12px;color:#8d867e">If the button does not work, copy this link:<br><span style="word-break:break-all">${actionUrl}</span></p>`
    : ''
  return `<!doctype html>
<html><body style="margin:0;background:#f9f9f7;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1c1917">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px">
    <div style="width:44px;height:44px;border-radius:12px;background:#c2410c;color:#fff;font-size:24px;font-weight:800;text-align:center;line-height:44px;margin-bottom:20px">V</div>
    <div style="background:#ffffff;border:1px solid #e7e3dd;border-radius:16px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
      ${bodyHtml}
      ${button}
    </div>
    <p style="font-size:12px;color:#8d867e;margin-top:16px">Veronis · run your place, simply. If you didn't request this email, you can safely ignore it.</p>
  </div>
</body></html>`
}
