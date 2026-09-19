'use server'

import { issueKey } from '@/lib/server/licences'
import { rateLimit } from '@/lib/server/store'

/**
 * Signing up does two things at once: it puts you on the release-notes list and it issues the
 * licence key SPYDR is activated with. One key per address: asking again neither issues a second
 * nor revokes the first, because revoking would break the machine already using it.
 *
 * Where the address goes beyond the licence database is up to you — SUBSCRIBE_WEBHOOK or
 * BUTTONDOWN_API_KEY. Neither is required for a key to be issued.
 */

export type SignupStatus = 'idle' | 'ok' | 'invalid' | 'error' | 'throttled' | 'exists'

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
    const issued = issueKey(email)
    if (issued.status === 'exists') {
      return {
        status: 'exists',
        message:
          'That address already has a key. It is not shown twice — use the one you were given, or get in touch if it is lost.'
      }
    }
    if (issued.status === 'error') {
      return { status: 'error', message: 'Could not issue a key. Try again in a minute.' }
    }

    await alsoSubscribe(email)
    return { status: 'ok', key: issued.key }
  } catch {
    return { status: 'error', message: 'Something went wrong issuing that key. Try again in a minute.' }
  }
}
