import { NextResponse } from 'next/server'
import { clientIp, readJson } from '@/lib/server/guard'
import { requireProductionEnv } from '@/lib/server/env'
import { rateLimit, store, underGlobalCap } from '@/lib/server/store'

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

/**
 * Every allowed field, rebuilt to a known shape and size.
 *
 * The key allow-list was already enforced here, which is the important half. The other half was
 * missing: the values were stored as they arrived, so an allowed key holding fifty megabytes was
 * accepted and written to disk. A full disk stops activation working for everybody, which makes an
 * anonymous counter into a way of taking the service down.
 */
function tidy(body: Record<string, unknown>): Record<string, unknown> {
  const text = (v: unknown, max: number): string => String(v ?? '').slice(0, max)
  const count = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.min(1_000_000, Math.trunc(n))) : 0
  }
  return {
    version: text(body.version, 32),
    os: text(body.os, 32),
    arch: text(body.arch, 16),
    workspacesUsed: Array.isArray(body.workspacesUsed)
      ? body.workspacesUsed.slice(0, 16).map((w) => text(w, 32))
      : [],
    domainCount: count(body.domainCount),
    objectsBucket: text(body.objectsBucket, 32),
    findingsBucket: text(body.findingsBucket, 32),
    reportsGenerated: count(body.reportsGenerated),
    sessionMinutesBucket: text(body.sessionMinutesBucket, 32)
  }
}

export async function POST(request: Request) {
  requireProductionEnv()

  if (!rateLimit(`telemetry:${clientIp(request)}`, 120, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }
  // Per-caller limits cannot answer "how much can the internet do", and this table is the one that
  // grows without bound. Silently accepted and dropped: a counter is not worth an error budget.
  if (!underGlobalCap('telemetry', 200_000, 24 * 60 * 60 * 1000)) {
    return new NextResponse(null, { status: 204 })
  }

  const parsed = await readJson<Record<string, unknown>>(request)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status })
  const body = parsed.body

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Send a JSON object.' }, { status: 400 })
  }

  const unexpected = Object.keys(body).filter((k) => !ALLOWED.has(k))
  if (unexpected.length > 0) {
    return NextResponse.json({ error: `Unexpected fields: ${unexpected.slice(0, 10).join(', ')}` }, { status: 400 })
  }

  const install = String(body.install ?? '').slice(0, 64)
  if (!/^[0-9a-f-]{8,64}$/i.test(install)) {
    return NextResponse.json({ error: 'A random install id is required.' }, { status: 400 })
  }

  const clean = tidy(body)
  store()
    .prepare('INSERT INTO telemetry (received_at, install, version, os, payload) VALUES (?, ?, ?, ?, ?)')
    .run(new Date().toISOString(), install, String(clean.version), String(clean.os), JSON.stringify(clean))

  return new NextResponse(null, { status: 204 })
}
