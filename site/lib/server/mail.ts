/**
 * Sending a key back to the address that owns it.
 *
 * Two providers, both optional: MAIL_WEBHOOK posts { to, subject, text } anywhere, and
 * RESEND_API_KEY uses Resend directly. With neither configured, recovery reports honestly that it
 * cannot deliver rather than claiming to have sent something.
 */

export type MailResult = { sent: true } | { sent: false; reason: 'unconfigured' | 'failed' }

export async function sendMail(to: string, subject: string, text: string): Promise<MailResult> {
  const webhook = process.env.MAIL_WEBHOOK
  const resend = process.env.RESEND_API_KEY
  const from = process.env.MAIL_FROM ?? 'SPYDR <keys@spydir.io>'

  try {
    if (webhook) {
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text })
      })
      return res.ok ? { sent: true } : { sent: false, reason: 'failed' }
    }
    if (resend) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, subject, text })
      })
      return res.ok ? { sent: true } : { sent: false, reason: 'failed' }
    }
  } catch {
    return { sent: false, reason: 'failed' }
  }
  return { sent: false, reason: 'unconfigured' }
}
