import { ExternalLink, KeyRound, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { keyLooksValid } from '@shared/license'
import { WidowMark } from '../components/WidowMark'
import { useApp } from '../state'

/**
 * First run: the key. Shown once, before anything else, because activation is what turns a
 * download into a known install. It is deliberately not a wall — the sample directory opens
 * without a key, so anyone can see what SPYDR does before handing over an email address.
 */
export function Activate() {
  const { activate, licence, openSample } = useApp()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)

  const shaped = keyLooksValid(key)

  const submit = async (): Promise<void> => {
    if (!shaped || busy) return
    setBusy(true)
    try {
      await activate(key)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="activate">
      <div className="activate-card">
        <header>
          <span className="brand-mark" aria-hidden>
            <WidowMark size={26} />
          </span>
          <div>
            <h1>SPYDR</h1>
            <p>Read-only Active Directory explorer</p>
          </div>
        </header>

        <h2>Enter your licence key</h2>
        <p className="muted">
          SPYDR is free. The key tells us how many people are using it and is checked once now, then about once a
          month. It never carries anything about your directory.
        </p>

        <label className="activate-field">
          <span className="mono">Licence key</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
            placeholder="SPYDR-XXXXX-XXXXX-XXXXX-XXXXX"
            spellCheck={false}
            autoFocus
          />
        </label>

        {licence.message ? <p className="activate-error">{licence.message}</p> : null}

        <div className="activate-actions">
          <button type="button" className="primary" disabled={!shaped || busy} onClick={() => void submit()}>
            {busy ? <Loader2 size={14} className="spin" aria-hidden /> : <KeyRound size={14} aria-hidden />}
            {busy ? 'Checking…' : 'Activate'}
          </button>
          <a className="linkish" href="https://getspydr.com/#downloads" target="_blank" rel="noreferrer">
            Get a key <ExternalLink size={12} aria-hidden />
          </a>
        </div>

        <footer>
          <button type="button" className="linkish" onClick={openSample}>
            Look around the sample directory first
          </button>
          <span className="muted">No key needed for the sample.</span>
        </footer>
      </div>
    </div>
  )
}
