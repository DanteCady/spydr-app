'use server'

import { randomUUID } from 'node:crypto'
import { hashKey, newKey } from '@/lib/server/keys'
import { rateLimit, store } from '@/lib/server/store'

/**
 * Signing up does two things at once: it puts you on the release-notes list and it issues the
 * licence key SPYDR is activated with. One form, because asking twice for the same address would
 * be silly.
 *
 * Where the address goes beyond the licence database is up to you — SUBSCRIBE_WEBHOOK or
 * BUTTONDOWN_API_KEY. Neither is required for a key to be issued.
 */

export type SignupStatus = 'idle' | 'ok' | 'invalid' | 'error' | 'throttled'

export interface SignupState {
  status: SignupStatus
  key?: string
  message?: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function alsoSubscribe(email: string): Promise<void> {
  const webhook = process.env.SUBSCRIBE_WEBHOOK
  const buttondown = process.env.BUTTONDOWN_API_KEY
  try {
    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'getspydr.com' })
      })
    } else if (buttondown) {
      await fetch('https://api.buttondown.email/v1/subscribers', {
        method: 'POST',
        headers: { Authorization: `Token ${buttondown}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
    }
  } catch {
    // The key is the thing that matters; a mailing-list hiccup must not lose it.
  }
}

export async function requestKey(_previous: SignupState, form: FormData): Promise<SignupState> {
  // Hidden from people, irresistible to bots.
  if (String(form.get('company') ?? '').trim() !== '') return { status: 'ok', key: 'SPYDR-XXXXX-XXXXX-XXXXX-XXXXX' }

  const email = String(form.get('email') ?? '').trim().toLowerCase()
  if (!EMAIL.test(email) || email.length > 254) {
    return { status: 'invalid', message: 'That does not look like an email address.' }
  }
  if (!rateLimit(`signup:${email}`, 5, 60 * 60 * 1000)) {
    return { status: 'throttled', message: 'That address has requested several keys. Try again later.' }
  }

  try {
    const db = store()
    const existing = db.prepare('SELECT id FROM licence WHERE email = ? AND revoked = 0').get(email) as
      | { id: string }
      | undefined
    if (existing) {
      // Only the hash is stored, so an old key cannot be read back — retire it and issue another.
      db.prepare('UPDATE licence SET revoked = 1, note = ? WHERE id = ?').run('reissued', existing.id)
    }

    const key = newKey()
    db.prepare(
      `INSERT INTO licence (id, email, key_hash, tier, features, created_at)
       VALUES (?, ?, ?, 'free', '[]', ?)`
    ).run(randomUUID(), email, hashKey(key), new Date().toISOString())

    await alsoSubscribe(email)
    return { status: 'ok', key }
  } catch {
    return { status: 'error', message: 'Something went wrong issuing that key. Try again in a minute.' }
  }
}
