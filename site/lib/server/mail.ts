import { createTransport, type Transporter } from 'nodemailer'
import type { Email } from '@/emails/layout'

/**
 * Sending mail.
 *
 * SMTP through nodemailer is the primary path, because it works with anything — SES, Resend's SMTP
 * endpoint, a Workspace account, a relay on the box — without this file knowing which. The two
 * older providers stay as fallbacks so an existing deployment does not break on the change.
 *
 * With none configured, this reports honestly that it cannot deliver rather than claiming to have
 * sent something. That distinction matters upstream: signup must not promise a code it never sent.
 */

export type MailResult = { sent: true } | { sent: false; reason: 'unconfigured' | 'failed' }

let transport: Transporter | null = null

function smtp(): Transporter | null {
  if (transport) return transport
  const host = process.env.SMTP_HOST?.trim()
  if (!host) return null

  const port = Number(process.env.SMTP_PORT ?? 587)
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS

  transport = createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 and 25 start in the clear and upgrade. requireTLS makes that
    // upgrade mandatory rather than opportunistic, so credentials are never sent in the clear.
    secure: port === 465,
    requireTLS: port !== 465,
    auth: user ? { user, pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000
  })
  return transport
}

export function mailFrom(): string {
  return process.env.MAIL_FROM ?? 'SPYDIR <keys@spydir.io>'
}

/** Whether anything is configured to send. Used to refuse a flow rather than half-run it. */
export function canSendMail(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim() || process.env.MAIL_WEBHOOK || process.env.RESEND_API_KEY)
}

export async function sendEmail(to: string, email: Email): Promise<MailResult> {
  const from = mailFrom()

  try {
    const smtpTransport = smtp()
    if (smtpTransport) {
      await smtpTransport.sendMail({ from, to, subject: email.subject, text: email.text, html: email.html })
      return { sent: true }
    }

    const webhook = process.env.MAIL_WEBHOOK
    if (webhook) {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject: email.subject, text: email.text, html: email.html })
      })
      return res.ok ? { sent: true } : { sent: false, reason: 'failed' }
    }

    const resend = process.env.RESEND_API_KEY
    if (resend) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject: email.subject, text: email.text, html: email.html })
      })
      return res.ok ? { sent: true } : { sent: false, reason: 'failed' }
    }
  } catch (err) {
    // The reason goes to the log, never to the caller: an SMTP error can say whether an address
    // exists at the receiving end, which is exactly what these flows must not reveal.
    console.error('[mail] send failed:', err instanceof Error ? err.message : err)
    return { sent: false, reason: 'failed' }
  }

  return { sent: false, reason: 'unconfigured' }
}

/** The older plain-text signature, kept so existing callers keep working. */
export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  return sendEmail(to, { subject, text, html: `<pre style="font:14px ui-monospace,monospace">${text}</pre>` })
}
