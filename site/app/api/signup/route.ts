import { NextResponse } from 'next/server'
import { clientIp, readEmail, readJson } from '@/lib/server/guard'
import { requireProductionEnv } from '@/lib/server/env'
import { canSendMail, sendEmail } from '@/lib/server/mail'
import { issueCode } from '@/lib/server/otp'
import { rateLimit, underGlobalCap } from '@/lib/server/store'
import { verifyCodeEmail } from '@/emails/verifyCode'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Step one of two: ask for a key, get a code by email.
 *
 * No key is issued here, and — importantly — the answer is identical whether or not the address
 * already has one. This endpoint used to reply 409 "that address already has a key", which told
 * anyone who asked which addresses were registered, and worse, the 200 case *issued* the key: type
 * a stranger's address and you took the only key it would ever be given, leaving the real owner
 * unable to sign up for something they never received. Proving the address is readable first
 * closes both, and makes the two cases indistinguishable from outside.
 */
export async function POST(request: Request) {
  requireProductionEnv()

  if (!rateLimit(`signup:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }
  if (!underGlobalCap('licences', 5_000, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Key issuing is paused. Try again later.' }, { status: 503 })
  }

  const parsed = await readJson<{ email?: string }>(request)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const address = readEmail(parsed.body.email)
  if (!address.ok) return NextResponse.json({ error: address.error }, { status: 400 })

  // Refuse rather than promise a code that cannot be sent. The whole flow depends on delivery,
  // and "check your inbox" when nothing was posted is the worst failure available here.
  if (!canSendMail()) {
    console.error('[signup] no mail provider configured (set SMTP_HOST, MAIL_WEBHOOK or RESEND_API_KEY)')
    return NextResponse.json({ error: 'Email is not available right now. Try again later.' }, { status: 503 })
  }

  const issued = issueCode(address.email)
  if (!issued.ok) {
    return NextResponse.json(
      { error: 'That address has been sent several codes already. Try again in a few minutes.' },
      { status: 429 }
    )
  }

  const result = await sendEmail(address.email, verifyCodeEmail(issued.code))
  if (!result.sent) {
    return NextResponse.json({ error: 'Could not send the code. Try again in a minute.' }, { status: 502 })
  }

  return NextResponse.json({ status: 'sent', expiresInMinutes: 10 })
}
