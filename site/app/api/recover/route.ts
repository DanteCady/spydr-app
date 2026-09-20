import { NextResponse } from 'next/server'
import { clientIp, readEmail, readJson } from '@/lib/server/guard'
import { requireProductionEnv } from '@/lib/server/env'
import { recoverKey } from '@/lib/server/licences'
import { sendMail } from '@/lib/server/mail'
import { rateLimit } from '@/lib/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Sends an existing key back to the address that owns it.
 *
 * The answer is the same whether or not the address has a key: anything else turns this endpoint
 * into a way of asking which email addresses use SPYDIR. The key is only ever delivered by email,
 * never in the response — otherwise knowing an address would be enough to take its licence.
 *
 * "The same" has to include failures, which is the part that was missing. A decrypt or a mail
 * send can only fail for an address that *is* registered, so letting either throw meant a 500 for
 * known addresses and a 202 for unknown ones — the enumeration oracle the design was built to
 * avoid, arrived at from the other direction. Everything below the address check is therefore
 * wrapped, and the mail is sent without the response waiting on it so the reply is not timed
 * differently either.
 */
export async function POST(request: Request) {
  requireProductionEnv()

  if (!rateLimit(`recover:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  const parsed = await readJson<{ email?: string }>(request)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const address = readEmail(parsed.body.email)
  if (!address.ok) return NextResponse.json({ error: address.error }, { status: 400 })

  const answer = { status: 'If that address has a key, it is on its way.' }

  // Deliberately not awaited: the response must not take longer for an address that exists.
  void (async () => {
    try {
      const key = recoverKey(address.email)
      if (!key) return

      const result = await sendMail(
        address.email,
        'Your SPYDIR licence key',
        [
          'Here is the licence key for this address:',
          '',
          `    ${key}`,
          '',
          'Enter it when SPYDIR asks, or in Settings ▸ Licence.',
          'SPYDIR is free; the key is how we know anyone is using it.'
        ].join('\n')
      )

      if (!result.sent) {
        // The operator learns from the log, which is the only place that can safely say more.
        console.error(
          result.reason === 'unconfigured'
            ? '[recover] a key was requested but no mail provider is configured (set SMTP_HOST, MAIL_WEBHOOK or RESEND_API_KEY)'
            : '[recover] a key was requested but the mail provider failed'
        )
      }
    } catch (err) {
      console.error('[recover] failed while sending a key:', err instanceof Error ? err.message : err)
    }
  })()

  return NextResponse.json(answer, { status: 202 })
}
