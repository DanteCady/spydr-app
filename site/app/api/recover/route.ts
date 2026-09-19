import { NextResponse } from 'next/server'
import { recoverKey } from '@/lib/server/licences'
import { sendMail } from '@/lib/server/mail'
import { rateLimit } from '@/lib/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Sends an existing key back to the address that owns it.
 *
 * The answer is the same whether or not the address has a key: anything else turns this endpoint
 * into a way of asking which email addresses use SPYDR. The key is only ever delivered by email,
 * never in the response — otherwise knowing an address would be enough to take its licence.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`recover:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let email = ''
  try {
    const body = (await request.json()) as { email?: string }
    email = String(body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Send JSON with an email.' }, { status: 400 })
  }
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 })

  const answer = { status: 'If that address has a key, it is on its way.' }

  const key = recoverKey(email)
  if (!key) return NextResponse.json(answer, { status: 202 })

  const result = await sendMail(
    email,
    'Your SPYDR licence key',
    [
      'Here is the licence key for this address:',
      '',
      `    ${key}`,
      '',
      'Enter it when SPYDR asks, or in Settings ▸ Licence.',
      'SPYDR is free; the key is how we know anyone is using it.'
    ].join('\n')
  )

  if (!result.sent) {
    // The reply stays identical either way: answering differently when a key exists would turn a
    // failed send into a way of testing which addresses are registered. The operator learns from
    // the log, which is the only place that can safely say more.
    console.error(
      result.reason === 'unconfigured'
        ? '[recover] a key was requested but no mail provider is configured (set MAIL_WEBHOOK or RESEND_API_KEY)'
        : '[recover] a key was requested but the mail provider failed'
    )
  }
  return NextResponse.json(answer, { status: 202 })
}
