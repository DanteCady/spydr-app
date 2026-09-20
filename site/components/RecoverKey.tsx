'use client'

import { useState } from 'react'

/**
 * Ask for a key to be sent again.
 *
 * The reply is the same whether or not the address is registered, and deliberately so: any other
 * behaviour turns this box into a way of asking which email addresses use SPYDR. That means the
 * success message has to be phrased as a conditional rather than a confirmation.
 */
export function RecoverKey() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      if (res.ok) setSent(true)
      else {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Something went wrong. Try again.')
      }
    } catch {
      setError('Could not reach the server. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="subscribe issued">
        <p className="mono label">Check your inbox</p>
        <p className="subscribe-note">
          If <strong>{email}</strong> has a key, it is on its way. We answer the same way either way, so that this
          box cannot be used to find out which addresses are registered.
        </p>
      </div>
    )
  }

  return (
    <form
      className="subscribe"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <p className="mono label">Send my key again</p>
      <div className="subscribe-row">
        <label className="sr-only" htmlFor="recover-email">
          The email address you signed up with
        </label>
        <input
          id="recover-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          value={email}
          disabled={busy}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn ghost" disabled={busy}>
          {busy ? 'Sending…' : 'Send it'}
        </button>
      </div>
      <p className={`subscribe-note${error ? ' bad' : ''}`} aria-live="polite">
        {error ?? 'The key goes to that address and is never shown here.'}
      </p>
    </form>
  )
}
