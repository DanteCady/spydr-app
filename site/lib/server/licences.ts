import { randomUUID } from 'node:crypto'
import { hashKey, newKey } from './keys'
import { encryptKey, decryptKey } from './secret'
import { store } from './store'

/**
 * Issuing keys, in one place — the signup form and the API route both come through here.
 *
 * One live key per address, enforced by a partial unique index rather than by remembering to
 * check. Asking again does not issue a second key and does not revoke the first: it says the
 * address already has one and offers to send it again, because revoking in that moment would
 * break the very installation someone is trying to get working.
 */

export type IssueResult =
  | { status: 'issued'; key: string }
  | { status: 'exists' }
  | { status: 'error' }

export function liveLicence(email: string): { id: string; key_enc: string | null } | undefined {
  return store()
    .prepare('SELECT id, key_enc FROM licence WHERE email = ? AND revoked = 0')
    .get(email) as { id: string; key_enc: string | null } | undefined
}

export function issueKey(email: string): IssueResult {
  if (liveLicence(email)) return { status: 'exists' }

  const db = store()
  // The keyspace is 100 bits, so a clash will not happen — but key_hash is UNIQUE, and an insert
  // that somehow loses that race should retry rather than fail in front of the person asking.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const key = newKey()
    try {
      db.prepare(
        `INSERT INTO licence (id, email, key_hash, key_enc, tier, features, created_at)
         VALUES (?, ?, ?, ?, 'free', '[]', ?)`
      ).run(randomUUID(), email, hashKey(key), encryptKey(key), new Date().toISOString())
      return { status: 'issued', key }
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      // The email index tripping means a request arrived twice at once; treat it as "exists".
      if (message.includes('licence_email_live')) return { status: 'exists' }
      if (!message.includes('UNIQUE')) return { status: 'error' }
    }
  }
  return { status: 'error' }
}

/**
 * The key belonging to an address, for sending it to that address and nowhere else. Older records
 * predate encrypted storage and cannot be recovered; those have to be reissued by hand.
 */
export function recoverKey(email: string): string | null {
  const licence = liveLicence(email)
  if (!licence?.key_enc) return null
  return decryptKey(licence.key_enc)
}
