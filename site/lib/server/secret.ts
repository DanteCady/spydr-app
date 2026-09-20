import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto'

/**
 * Licence keys are kept encrypted rather than hashed.
 *
 * Hashing was the safer instinct, but it made "I lost my key" unanswerable: with one key per
 * address and no way to read it back, losing it would lock someone out of a free product forever.
 * Encrypted at rest with a server-side secret is the right trade for a licence key — it is not a
 * password and not a payment credential, and being able to re-send one to the address that owns it
 * matters more than the marginal gain of a one-way hash.
 */

function raw(): string {
  const value = process.env.LICENSE_SECRET ?? process.env.LICENSE_PEPPER
  if (!value) throw new Error('LICENSE_SECRET is not set, so keys cannot be stored safely.')
  return value
}

/**
 * The original derivation: one pass of SHA-256. Kept only to read rows written before the change.
 *
 * A single hash is not a key derivation function. If the operator ever set something memorable,
 * the key_enc column — which is plaintext licence keys for every user — becomes an offline
 * guessing target at billions of attempts per second.
 */
function legacyKey(): Buffer {
  return createHash('sha256').update(raw()).digest()
}

/**
 * scrypt with a per-record salt, which is what this should have been.
 *
 * The cost parameters match the reserved-keys script, which got this right. The salt is stored
 * beside the ciphertext, so rows stay independent: one cracked record tells you nothing about the
 * next, and there is no precomputation across the table.
 */
function derive(salt: Buffer): Buffer {
  return scryptSync(raw(), salt, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 2 ** 15 * 8 * 2 })
}

const V2 = 'v2'

export function encryptKey(key: string): string {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', derive(salt), iv)
  const body = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()])
  return [V2, salt.toString('base64'), iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.')
}

export function decryptKey(stored: string): string | null {
  try {
    const parts = stored.split('.')
    // Three parts is the pre-scrypt format. Five means a version marker leads.
    const [key, iv, tag, body] =
      parts[0] === V2
        ? [derive(Buffer.from(parts[1], 'base64')), parts[2], parts[3], parts[4]]
        : [legacyKey(), parts[0], parts[1], parts[2]]

    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** Whether a stored value still uses the old derivation, so it can be rewritten on next touch. */
export function isLegacyFormat(stored: string): boolean {
  return stored.split('.')[0] !== V2
}
