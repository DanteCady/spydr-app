// Pure parsers for the wire shapes Active Directory returns. Kept separate from the LDAP client
// so they can be tested without a directory: every one of these has bitten us at least once.

export function first(value: unknown): string {
  if (value == null) return ''
  if (Array.isArray(value)) return first(value[0])
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  if (typeof value === 'object' && value !== null && 'toString' in value) return String(value)
  return String(value)
}

export function strings(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((v) => first(v)).filter(Boolean)
  const s = first(value)
  return s ? [s] : []
}

export function guidFrom(entry: Record<string, unknown>): string {
  const raw = entry.objectGUID ?? entry.objectguid
  const buf = Buffer.isBuffer(raw) ? raw : Array.isArray(raw) && Buffer.isBuffer(raw[0]) ? raw[0] : null
  if (!buf || buf.length !== 16) return first(entry.distinguishedName) || cryptoRandom()
  const b = Buffer.from([
    buf[3],
    buf[2],
    buf[1],
    buf[0],
    buf[5],
    buf[4],
    buf[7],
    buf[6],
    buf[8],
    buf[9],
    buf[10],
    buf[11],
    buf[12],
    buf[13],
    buf[14],
    buf[15]
  ])
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

export function cryptoRandom(): string {
  return `obj-${Math.random().toString(16).slice(2)}`
}

export function parentDn(dn: string): string | null {
  for (let i = 0; i < dn.length; i++) {
    if (dn[i] === '\\') {
      i++
      continue
    }
    if (dn[i] === ',') return dn.slice(i + 1)
  }
  return null
}

export function ridFrom(raw: unknown): number | null {
  const buf = Buffer.isBuffer(raw) ? raw : Array.isArray(raw) && Buffer.isBuffer(raw[0]) ? raw[0] : null
  if (!buf || buf.length < 12) return null
  const subAuthorityCount = buf[1]
  const end = 8 + subAuthorityCount * 4
  if (subAuthorityCount === 0 || buf.length < end) return null
  return buf.readUInt32LE(end - 4)
}

export function fileTimeMs(value: unknown): number | null {
  const s = first(value)
  if (!s || s === '0') return null
  try {
    const n = BigInt(s)
    if (n === 0n) return null
    return Number(n / 10000n - 11644473600000n)
  } catch {
    return null
  }
}

export function generalizedTime(value: unknown): string | undefined {
  const s = first(value)
  if (!s) return undefined
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(s)
  if (!m) return s
  // Shapely but impossible values (month 19, day 40) reach here; toISOString would throw on those
  // and take the whole ingest down, so the raw value is handed back instead.
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`)
  return Number.isNaN(date.getTime()) ? s : date.toISOString()
}

export function memberAttrNames(entry: Record<string, unknown>): string[] {
  return Object.keys(entry).filter((k) => k.toLowerCase().startsWith('member'))
}
