import { NextResponse } from 'next/server'
import { clientIp, readEmail, readJson } from '@/lib/server/guard'
import { requireProductionEnv } from '@/lib/server/env'
import { issueKey } from '@/lib/server/licences'
import { rateLimit, underGlobalCap } from '@/lib/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Signup issues a free licence key — one per address. Asking again neither issues a second nor
 * revokes the first; it reports that the address already has one.
 */
export async function POST(request: Request) {
  requireProductionEnv()

  if (!rateLimit(`signup:${clientIp(request)}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }
  // A ceiling for the whole instance. Per-caller limits cannot bound what the internet as a whole
  // can mint, and every issued key is a row plus an encrypted secret on disk.
  if (!underGlobalCap('licences', 5_000, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Key issuing is paused. Try again later.' }, { status: 503 })
  }

  const parsed = await readJson<{ email?: string }>(request)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })

  const address = readEmail(parsed.body.email)
  if (!address.ok) return NextResponse.json({ error: address.error }, { status: 400 })
  const email = address.email

  const issued = issueKey(email)
  if (issued.status === 'exists') {
    return NextResponse.json(
      { error: 'That address already has a key.', recover: '/api/recover' },
      { status: 409 }
    )
  }
  if (issued.status === 'error') {
    return NextResponse.json({ error: 'Could not issue a key. Try again.' }, { status: 500 })
  }

  return NextResponse.json({ key: issued.key, tier: 'free' })
}
