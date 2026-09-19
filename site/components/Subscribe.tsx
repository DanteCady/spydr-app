'use client'

import { useActionState, useState } from 'react'
import { requestKey, type SignupState } from '@/app/actions/subscribe'

const INITIAL: SignupState = { status: 'idle' }

export function Subscribe() {
  const [state, action, pending] = useActionState(requestKey, INITIAL)
  const [copied, setCopied] = useState(false)

  if (state.status === 'ok' && state.key) {
    return (
      <div className="subscribe issued">
        <p className="mono label">Your licence key</p>
        <div className="key-row">
          <code>{state.key}</code>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              void navigator.clipboard.writeText(state.key ?? '').then(() => setCopied(true))
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <p className="subscribe-note">
          Keep it somewhere you will find it again. SPYDR asks for it once, on first run, and you are on the list for
          release notes.
        </p>
      </div>
    )
  }

  return (
    <form className="subscribe" action={action}>
      <label className="sr-only" htmlFor="subscribe-email">
        Email address for your licence key
      </label>
      <p className="mono label">Free licence key</p>
      <div className="subscribe-row">
        <input
          id="subscribe-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          disabled={pending}
          aria-invalid={state.status === 'invalid'}
        />
        <input className="sr-only" name="company" tabIndex={-1} autoComplete="off" aria-hidden />
        <button type="submit" className="btn ghost" disabled={pending}>
          {pending ? 'Issuing…' : 'Get a key'}
        </button>
      </div>
      <p
        className={`subscribe-note${state.status === 'invalid' || state.status === 'error' || state.status === 'throttled' ? ' bad' : ''}`}
        aria-live="polite"
      >
        {state.status === 'idle'
          ? 'SPYDR is free and asks for a key on first run. You also get told when a version ships — nothing else, ever.'
          : (state.message ?? '')}
      </p>
    </form>
  )
}
