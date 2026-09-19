import { ExternalLink, KeyRound, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { keyLooksValid } from '@shared/license'
import { WidowMark } from '../components/WidowMark'
import { useApp } from '../state'

/**
 * First run: the key. It takes the whole window, like the welcome screen it leads to, rather than
 * sitting in a dialog — this is the first thing anyone sees of SPYDR, and a box floating in the
 * middle of an empty window says "installer", not "tool".
 *
 * It is deliberately not a wall: the sample directory opens without a key, so anyone can see what
 * SPYDR does before handing over an email address.
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
    <div className="welcome activate">
      <div className="welcome-inner">
        <header className="welcome-head">
          <span className="welcome-mark" aria-hidden>
            <WidowMark size={34} />
          </span>
          <div>
            <h1>SPYDR</h1>
            <p>Read-only Active Directory explorer</p>
          </div>
        </header>

        <div className="activate-cols">
          <section>
            <h2>Enter your licence key</h2>
            <p className="activate-lede">
              SPYDR is free. The key is how we know anyone is using it, and it is checked once now and about once a
              month after that.
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
              <a className="linkish" href="https://getspydr.com" target="_blank" rel="noreferrer">
                Get a free key <ExternalLink size={12} aria-hidden />
              </a>
            </div>
          </section>

          <aside className="activate-aside">
            <h3>What the check carries</h3>
            <dl>
              <dt>The key</dt>
              <dd>and nothing else that identifies you.</dd>
              <dt>This installation</dt>
              <dd>as a hash, to count installs rather than recognise a machine.</dd>
              <dt>Version and platform</dt>
              <dd>so we know what to keep building for.</dd>
            </dl>
            <p className="activate-never">
              Never a domain, an account, a group or anything else read from your directory.
            </p>
            <div className="activate-sample">
              <button type="button" className="linkish" onClick={openSample}>
                Look around the sample directory first
              </button>
              <span className="muted">No key needed — it is fictional data that never touches your network.</span>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
