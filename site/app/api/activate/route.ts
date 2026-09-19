import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { hashKey, keyLooksValid, signPayload } from '@/lib/server/keys'
import { rateLimit, store } from '@/lib/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** How long the desktop app may trust this answer before asking again. */
const VALID_DAYS = 30

interface LicenceRow {
  id: string
  email: string
  tier: string
  features: string
  expires_at: string | null
  revoked: number
}

/**
 * Activation.
 *
 * The response is signed, so the app can cache it for a month and still know it came from here.
 * The machine identifier arrives already hashed by the client and is hashed again with a server
 * pepper — enough to count installs, not enough to identify a computer.
 */
export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`activate:${ip}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  let key = ''
  let machine = ''
  let version = ''
  let os = ''
  try {
    const body = (await request.json()) as { key?: string; machine?: string; version?: string; os?: string }
    key = String(body.key ?? '')
    machine = String(body.machine ?? '').slice(0, 128)
    version = String(body.version ?? '').slice(0, 32)
    os = String(body.os ?? '').slice(0, 32)
  } catch {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 400 })
  }

  if (!keyLooksValid(key)) {
    return NextResponse.json({ error: 'That key is not in the right shape.' }, { status: 400 })
  }

  const db = store()
  const row = db.prepare('SELECT * FROM licence WHERE key_hash = ?').get(hashKey(key)) as LicenceRow | undefined

  if (!row) return NextResponse.json({ error: 'That key is not recognised.' }, { status: 404 })
  if (row.revoked) return NextResponse.json({ error: 'That key has been withdrawn.' }, { status: 403 })
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: 'That key has expired.' }, { status: 403 })
  }

  if (machine) {
    const peppered = createHash('sha256')
      .update(`${process.env.LICENSE_PEPPER ?? 'spydr'}:${machine}`)
      .digest('hex')
    const now = new Date().toISOString()
    db.prepare(
      `INSERT INTO activation (licence_id, machine, first_seen, last_seen, version, os)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (licence_id, machine)
       DO UPDATE SET last_seen = excluded.last_seen, version = excluded.version, os = excluded.os, count = count + 1`
    ).run(row.id, peppered, now, now, version, os)
  }

  const issuedAt = new Date()
  const notAfter = new Date(issuedAt.getTime() + VALID_DAYS * 86_400_000)
  const signed = signPayload({
    key: key.toUpperCase(),
    email: row.email,
    tier: row.tier,
    features: JSON.parse(row.features) as string[],
    expiresAt: row.expires_at,
    issuedAt: issuedAt.toISOString(),
    notAfter: notAfter.toISOString()
  })

  return NextResponse.json(signed)
}
