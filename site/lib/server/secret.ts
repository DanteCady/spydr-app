import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

/**
 * Licence keys are kept encrypted rather than hashed.
 *
 * Hashing was the safer instinct, but it made "I lost my key" unanswerable: with one key per
 * address and no way to read it back, losing it would lock someone out of a free product forever.
 * Encrypted at rest with a server-side secret is the right trade for a licence key — it is not a
 * password and not a payment credential, and being able to re-send one to the address that owns it
 * matters more than the marginal gain of a one-way hash.
 */

function secret(): Buffer {
  const raw = process.env.LICENSE_SECRET ?? process.env.LICENSE_PEPPER
  if (!raw) throw new Error('LICENSE_SECRET is not set, so keys cannot be stored safely.')
  return createHash('sha256').update(raw).digest()
}

export function encryptKey(key: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secret(), iv)
  const body = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()])
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.')
}

export function decryptKey(stored: string): string | null {
  try {
    const [iv, tag, body] = stored.split('.')
    const decipher = createDecipheriv('aes-256-gcm', secret(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
