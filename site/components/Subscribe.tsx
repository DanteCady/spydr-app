'use client'

import { useActionState } from 'react'
import { subscribe, type SubscribeState } from '@/app/actions/subscribe'

const INITIAL: SubscribeState = { status: 'idle' }

const NOTE: Record<Exclude<SubscribeState['status'], 'idle'>, string> = {
  ok: 'You are on the list. Release notes only.',
  invalid: 'That does not look like an email address.',
  error: 'Something went wrong sending that. Try again in a minute.',
  unconfigured: 'The list is not wired up yet — nothing was sent, and nothing was stored.'
}

export function Subscribe() {
  const [state, action, pending] = useActionState(subscribe, INITIAL)
  const done = state.status === 'ok'

  return (
    <form className="subscribe" action={action}>
      <label className="sr-only" htmlFor="subscribe-email">
        Email address for release notes
      </label>
      <div className="subscribe-row">
        <input
          id="subscribe-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          disabled={pending || done}
          aria-invalid={state.status === 'invalid'}
        />
        {/* Hidden from people, irresistible to bots. */}
        <input className="sr-only" name="company" tabIndex={-1} autoComplete="off" aria-hidden />
        <button type="submit" className="btn ghost" disabled={pending || done}>
          {pending ? 'Sending…' : done ? 'Done' : 'Notify me'}
        </button>
      </div>
      <p className={`subscribe-note${state.status === 'invalid' || state.status === 'error' ? ' bad' : ''}`} aria-live="polite">
        {state.status === 'idle'
          ? 'Told when a version ships, and nothing else. No analytics on this page, and the address goes nowhere but the list.'
          : (state.message ?? NOTE[state.status])}
      </p>
    </form>
  )
}
