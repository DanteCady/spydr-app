import { createHash, generateKeyPairSync, randomBytes, sign as edSign, createPrivateKey, createPublicKey } from 'node:crypto'

/**
 * Licence keys and the signatures over activation responses.
 *
 * A key is a random string; the server is the authority on what it means. The activation response
 * is signed with Ed25519 so the desktop app can cache it for weeks and still know the answer came
 * from us rather than from a hosts-file entry pointing somewhere else.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32: no I, L, O, U

export function newKey(): string {
  const bytes = randomBytes(20)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return `SPYDR-${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15, 20)}`
}

export function normalizeKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '')
}

/** Keys are stored hashed, so a copy of the database is not a pile of working licences. */
export function hashKey(key: string): string {
  return createHash('sha256').update(normalizeKey(key)).digest('hex')
}

export function keyLooksValid(key: string): boolean {
  return /^SPYDR-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/.test(
    normalizeKey(key)
  )
}

/**
 * The signing key lives in LICENSE_PRIVATE_KEY as a PKCS#8 PEM. Without one the server generates an
 * ephemeral pair and says so — fine for local work, useless in production, and loud about it.
 */
let cached: { privateKey: ReturnType<typeof createPrivateKey>; publicPem: string; ephemeral: boolean } | null = null

export function signingKey() {
  if (cached) return cached
  const pem = process.env.LICENSE_PRIVATE_KEY
  if (pem) {
    const privateKey = createPrivateKey(pem.replace(/\\n/g, '\n'))
    const publicPem = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString()
    cached = { privateKey, publicPem, ephemeral: false }
    return cached
  }
  const pair = generateKeyPairSync('ed25519')
  cached = {
    privateKey: pair.privateKey,
    publicPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    ephemeral: true
  }
  return cached
}

export function signPayload(payload: object): { payload: string; signature: string } {
  const json = JSON.stringify(payload)
  const signature = edSign(null, Buffer.from(json, 'utf8'), signingKey().privateKey)
  return { payload: Buffer.from(json, 'utf8').toString('base64'), signature: signature.toString('base64') }
}
