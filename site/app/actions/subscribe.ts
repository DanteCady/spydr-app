'use server'

/**
 * The update list.
 *
 * The address goes wherever you configure, and nowhere else — there is no database here and no
 * third party watching the page. Set one of:
 *
 *   SUBSCRIBE_WEBHOOK   any URL that accepts POST { email, source }
 *   BUTTONDOWN_API_KEY  posts to Buttondown's subscribers endpoint
 *
 * With neither set the form says so rather than thanking someone for an address it just dropped.
 */

export type SubscribeStatus = 'idle' | 'ok' | 'invalid' | 'error' | 'unconfigured'

export interface SubscribeState {
  status: SubscribeStatus
  message?: string
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

async function deliver(email: string): Promise<SubscribeState> {
  const webhook = process.env.SUBSCRIBE_WEBHOOK
  const buttondown = process.env.BUTTONDOWN_API_KEY

  if (webhook) {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source: 'spydr.site' })
    })
    if (!res.ok) throw new Error(`webhook answered ${res.status}`)
    return { status: 'ok' }
  }

  if (buttondown) {
    const res = await fetch('https://api.buttondown.email/v1/subscribers', {
      method: 'POST',
      headers: { Authorization: `Token ${buttondown}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    // Already on the list is a success from the reader's point of view.
    if (res.status === 409) return { status: 'ok', message: 'You were already on the list.' }
    if (!res.ok) throw new Error(`buttondown answered ${res.status}`)
    return { status: 'ok' }
  }

  return { status: 'unconfigured' }
}

export async function subscribe(_previous: SubscribeState, form: FormData): Promise<SubscribeState> {
  // A field no person can see and every naive bot fills in.
  if (String(form.get('company') ?? '').trim() !== '') return { status: 'ok' }

  const email = String(form.get('email') ?? '').trim()
  if (!EMAIL.test(email) || email.length > 254) {
    return { status: 'invalid', message: 'That does not look like an email address.' }
  }

  try {
    return await deliver(email)
  } catch {
    return { status: 'error', message: 'Something went wrong sending that. Try again in a minute.' }
  }
}
