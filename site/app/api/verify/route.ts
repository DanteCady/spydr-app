import { NextResponse } from 'next/server'
import { clientIp, readEmail, readJson } from '@/lib/server/guard'
import { requireProductionEnv } from '@/lib/server/env'
import { issueKey, recoverKey } from '@/lib/server/licences'
import { sendEmail } from '@/lib/server/mail'
import { checkCode } from '@/lib/server/otp'
import { rateLimit } from '@/lib/server/store'
import { licenceKeyEmail } from '@/emails/licenceKey'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Step two: the code, and then the key.
 *
 * Once the address is proven, "already has a key" stops being a secret worth keeping — the person
 * asking has just demonstrated they can read that mailbox, so telling them is telling the owner.
 * They get the existing key rather than a new one, because issuing a second would break the
 * machine already using the first.
 *
 * The key goes by email in both cases and is not in the response body, so a key cannot be taken by
 * anyone who merely watched the code go past.
 */
export async function POST(request: Request) {
  requireProductionEnv()

  // Tighter than signup: this is the endpoint a guessing attack would aim at.
  if (!rateLimit(`verify:${clientIp(request)}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 })
  }

  const parsed = await readJson<{ email?: string; code?: string }>(request)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const address = readEmail(parsed.body.email)
  if (!address.ok) return NextResponse.json({ error: address.error }, { status: 400 })

  const code = String(parsed.body.code ?? '').replace(/\D/g, '')
  if (code.length !== 6) {
    return NextResponse.json({ error: 'Enter the six-digit code from your email.' }, { status: 400 })
  }

  const checked = checkCode(address.email, code)
  if (!checked.ok) {
    const message =
      checked.reason === 'expired'
        ? 'That code has expired. Ask for a new one.'
        : checked.reason === 'exhausted'
          ? 'Too many wrong codes. Ask for a new one.'
          : `That code is not right. ${checked.attemptsLeft} attempt${checked.attemptsLeft === 1 ? '' : 's'} left.`
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Verified. Issue, or hand back what this address already owns.
  const issued = issueKey(address.email)
  const key = issued.status === 'issued' ? issued.key : recoverKey(address.email)

  if (!key) {
    // An address with a licence predating encrypted storage, so the key cannot be read back.
    console.error(`[verify] verified address has a licence whose key cannot be recovered: ${address.email}`)
    return NextResponse.json(
      { error: 'Your address is registered but the key could not be read. Please contact support@spydir.io.' },
      { status: 500 }
    )
  }

  const sent = await sendEmail(address.email, licenceKeyEmail(key))
  if (!sent.sent) {
    return NextResponse.json({ error: 'Could not send your key. Try again in a minute.' }, { status: 502 })
  }

  return NextResponse.json({
    status: 'ok',
    // Enough to show it arrived, not enough to use.
    hint: `${key.slice(0, 6)}…${key.slice(-5)}`,
    reissued: issued.status !== 'issued'
  })
}
