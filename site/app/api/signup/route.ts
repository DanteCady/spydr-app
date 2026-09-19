import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { hashKey, newKey } from '@/lib/server/keys'
import { rateLimit, store } from '@/lib/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Signup issues a free licence key.
 *
 * One key per email: asking twice returns the same key rather than littering the database, which
 * also means "I lost my key" is answered by signing up again.
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

  const db = store()
  const existing = db.prepare('SELECT id FROM licence WHERE email = ? AND revoked = 0').get(email) as
    | { id: string }
    | undefined
  if (existing) {
    // The key itself is not recoverable — only its hash is kept — so issue a fresh one and retire
    // the old record rather than pretending we can read it back.
    db.prepare('UPDATE licence SET revoked = 1, note = ? WHERE id = ?').run('reissued', existing.id)
  }

  const key = newKey()
  db.prepare(
    `INSERT INTO licence (id, email, key_hash, tier, features, created_at)
     VALUES (?, ?, ?, 'free', '[]', ?)`
  ).run(randomUUID(), email, hashKey(key), new Date().toISOString())

  return NextResponse.json({ key, tier: 'free' })
}
