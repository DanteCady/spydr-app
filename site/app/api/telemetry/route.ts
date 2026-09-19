import { NextResponse } from 'next/server'
import { rateLimit, store } from '@/lib/server/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Anonymous usage, sent only by installs where someone turned it on.
 *
 * Anything that could name a person, a group or a domain is rejected rather than stored — the
 * endpoint refuses payloads carrying unexpected keys, so a future client bug cannot quietly start
 * sending more than was promised.
 */
const ALLOWED = new Set([
  'install',
  'version',
  'os',
  'arch',
  'workspacesUsed',
  'domainCount',
  'objectsBucket',
  'findingsBucket',
  'reportsGenerated',
  'sessionMinutesBucket'
])

export async function POST(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!rateLimit(`telemetry:${ip}`, 120, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Send JSON.' }, { status: 400 })
  }

  const unexpected = Object.keys(body).filter((k) => !ALLOWED.has(k))
  if (unexpected.length > 0) {
    return NextResponse.json({ error: `Unexpected fields: ${unexpected.join(', ')}` }, { status: 400 })
  }

  const install = String(body.install ?? '').slice(0, 64)
  if (!/^[0-9a-f-]{8,64}$/i.test(install)) {
    return NextResponse.json({ error: 'A random install id is required.' }, { status: 400 })
  }

  store()
    .prepare('INSERT INTO telemetry (received_at, install, version, os, payload) VALUES (?, ?, ?, ?, ?)')
    .run(
      new Date().toISOString(),
      install,
      String(body.version ?? '').slice(0, 32),
      String(body.os ?? '').slice(0, 32),
      JSON.stringify(body)
    )

  return new NextResponse(null, { status: 204 })
}
