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
  return `SPYDIR-${out.slice(0, 5)}-${out.slice(5, 10)}-${out.slice(10, 15)}-${out.slice(15, 20)}`
}

/**
 * The canonical form, matching the desktop app's normaliser exactly — a key pasted with line
 * breaks, odd spaces or missing dashes has to hash to the same value as the one we issued.
 */
/** Must match KEY_PREFIX in shared/license.ts — the two sides hash the same canonical string. */
export const KEY_PREFIX = 'SPYDIR'

export function normalizeKey(raw: string): string {
  const characters = raw.toUpperCase().replace(/[^0-9A-Z]/g, '')
  const body = characters.startsWith(KEY_PREFIX) ? characters.slice(KEY_PREFIX.length) : characters
  const groups = body.slice(0, 20).match(/.{1,5}/g)
  return groups ? `SPYDIR-${groups.join('-')}` : 'SPYDIR-'
}

/**
 * The hash a key is looked up by.
 *
 * Note that this is not the only copy: licences.ts also stores the key encrypted under
 * LICENSE_SECRET, so a lost one can be sent again. The hash is what activation matches against;
 * the ciphertext is what recovery reads. A stolen database is therefore only as safe as that
 * secret, which is why env.ts refuses to start production without a strong one.
 */
export function hashKey(key: string): string {
  return createHash('sha256').update(normalizeKey(key)).digest('hex')
}

export function keyLooksValid(key: string): boolean {
  return /^SPYDIR-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/.test(
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
