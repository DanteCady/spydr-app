'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Email, then code, then done — in one place, without the field moving.
 *
 * The form does not navigate or swap layout between steps: the same box becomes the code box, so
 * the address stays visible above it and going back is a click rather than starting over. The key
 * itself never appears here. It is emailed, which is what makes "I lost it" answerable and what
 * stops anyone who glimpsed the code from walking off with the key.
 */

type Step = 'email' | 'code' | 'done'

export function Subscribe() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reissued, setReissued] = useState(false)
  const codeRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus()
  }, [step])

  async function post(path: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, data }
  }

  async function requestCode(resend = false): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const { ok, data } = await post('/api/signup', { email })
      if (!ok) {
        setError(String(data.error ?? 'Something went wrong. Try again.'))
        return
      }
      if (!resend) setStep('code')
      setCode('')
    } catch {
      setError('Could not reach the server. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const { ok, data } = await post('/api/verify', { email, code })
      if (!ok) {
        setError(String(data.error ?? 'Something went wrong. Try again.'))
        return
      }
      setReissued(Boolean(data.reissued))
      setStep('done')
    } catch {
      setError('Could not reach the server. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="subscribe issued">
        <p className="mono label">Check your inbox</p>
        <p className="subscribe-note">
          {reissued
            ? 'That address already had a key, so we sent it again rather than issuing a second — the one you have keeps working.'
            : 'Your licence key is on its way to '}
          {reissued ? null : <strong>{email}</strong>}
          {reissued ? null : '. '}
          {reissued ? ' ' : null}
          Keep the email; it is the only copy we can send you.
        </p>
      </div>
    )
  }

  return (
    <form
      className="subscribe"
      onSubmit={(e) => {
        e.preventDefault()
        void (step === 'email' ? requestCode() : submitCode())
      }}
    >
      <p className="mono label">{step === 'email' ? 'Free licence key' : 'Enter your code'}</p>

      {step === 'email' ? (
        <div className="subscribe-row">
          <label className="sr-only" htmlFor="subscribe-email">
            Email address for your licence key
          </label>
          <input
            id="subscribe-email"
            name="email"
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
            {busy ? 'Sending…' : 'Get a key'}
          </button>
        </div>
      ) : (
        <div className="subscribe-row">
          <label className="sr-only" htmlFor="subscribe-code">
            The six-digit code sent to {email}
          </label>
          <input
            id="subscribe-code"
            ref={codeRef}
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            className="code-input"
            required
            value={code}
            disabled={busy}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button type="submit" className="btn ghost" disabled={busy || code.length !== 6}>
            {busy ? 'Checking…' : 'Confirm'}
          </button>
        </div>
      )}

      <p className={`subscribe-note${error ? ' bad' : ''}`} aria-live="polite">
        {error ??
          (step === 'email'
            ? 'SPYDR is free and asks for a key on first run. We send a code to confirm the address, then the key itself — nothing else, ever.'
            : `We sent a six-digit code to ${email}. It expires in ten minutes.`)}
      </p>

      {step === 'code' && !busy ? (
        <p className="subscribe-actions">
          <button type="button" className="linkish" onClick={() => void requestCode(true)}>
            Send another code
          </button>
          <button
            type="button"
            className="linkish"
            onClick={() => {
              setStep('email')
              setError(null)
              setCode('')
            }}
          >
            Use a different address
          </button>
        </p>
      ) : null}
    </form>
  )
}
