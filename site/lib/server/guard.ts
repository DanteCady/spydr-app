/**
 * What every public route does before it does anything else.
 *
 * All of this exists because the routes here are unauthenticated by design: signing up for a free
 * key cannot require an account, so the only things standing between the box and the internet are
 * the checks in this file.
 */

/**
 * The caller's address, as far as it can be trusted.
 *
 * X-Forwarded-For is a list the client starts and each proxy appends to, so its *left* end is
 * whatever the client felt like writing and only the right end is written by infrastructure we
 * control. Reading `[0]` — which is the obvious thing to do, and what this used to do — hands the
 * rate limiter a value the attacker picks, which makes every limit on the box decorative.
 *
 * TRUST_PROXY_HOPS says how many proxies sit in front of Node. With the standard one nginx in
 * front, the last entry is the address nginx observed, and the client cannot forge past it.
 */
export function clientIp(request: Request): string {
  // Unset means "no proxy has been vouched for", and an unvouched X-Forwarded-For is just a string
  // the caller chose. Everyone then shares one bucket, which throttles hard and wrongly — the
  // correct failure for a server that has not been told how it is deployed. Production must set
  // this, and requireProductionEnv refuses to start without it.
  const declared = process.env.TRUST_PROXY_HOPS?.trim()
  if (!declared) return 'untrusted-proxy'

  const hops = Math.max(1, Number(declared) || 1)
  const parts = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)

  // Fewer entries than there are proxies means the request did not arrive the way we were told it
  // would, so nothing in the header is vouched for.
  if (parts.length < hops) return 'untrusted-proxy'
  // Count in from the right: each trusted proxy appends, so anything further left came from the
  // caller and can say whatever it likes.
  return parts[parts.length - hops] ?? 'untrusted-proxy'
}

/** How much JSON any of these endpoints could legitimately need. Telemetry is the largest. */
const MAX_BODY = 8 * 1024

/**
 * Read a JSON body without letting the caller choose how much memory that costs.
 *
 * `await request.json()` buffers whatever arrives before any of our code runs, so a route that
 * validates carefully afterwards has already lost. Content-Length is checked first because it is
 * free, and the stream is then counted as it arrives because Content-Length is a claim, not a fact.
 */
export async function readJson<T>(request: Request): Promise<{ ok: true; body: T } | { ok: false; status: number; error: string }> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY) return { ok: false, status: 413, error: 'That request is too large.' }

  const reader = request.body?.getReader()
  if (!reader) return { ok: false, status: 400, error: 'Send JSON.' }

  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY) {
      await reader.cancel()
      return { ok: false, status: 413, error: 'That request is too large.' }
    }
    chunks.push(value)
  }

  try {
    const text = Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8')
    return { ok: true, body: JSON.parse(text) as T }
  } catch {
    return { ok: false, status: 400, error: 'Send JSON.' }
  }
}

/**
 * An address, reduced to the account it actually reaches.
 *
 * "One key per email" is only as true as the definition of "same email". Plus-addressing and
 * capitalisation both deliver to the same inbox, so without folding them a single mailbox can hold
 * as many keys as it cares to ask for.
 */
export function foldEmail(raw: string): string {
  const trimmed = raw.normalize('NFKC').trim().toLowerCase()
  const at = trimmed.lastIndexOf('@')
  if (at < 1) return trimmed
  const local = trimmed.slice(0, at).split('+')[0]
  return `${local}@${trimmed.slice(at + 1)}`
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Shape, length, and a folded form — everything a route needs to decide about an address. */
export function readEmail(value: unknown): { ok: true; email: string } | { ok: false; error: string } {
  const raw = String(value ?? '').trim()
  if (raw.length > 254 || !EMAIL.test(raw)) return { ok: false, error: 'That does not look like an email address.' }
  return { ok: true, email: foldEmail(raw) }
}
