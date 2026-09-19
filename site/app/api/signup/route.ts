import { NextResponse } from 'next/server'
import { issueKey } from '@/lib/server/licences'
import { rateLimit } from '@/lib/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Signup issues a free licence key — one per address. Asking again neither issues a second nor
 * revokes the first; it reports that the address already has one.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`signup:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
  }

  let email = ''
  try {
    const body = (await request.json()) as { email?: string }
    email = String(body.email ?? '').trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Send JSON with an email.' }, { status: 400 })
  }
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'That does not look like an email address.' }, { status: 400 })
  }

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
