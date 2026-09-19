import { ExternalLink, KeyRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { keyLooksValid, normalizeKey, tidyKeyInput } from '@shared/license'
import { SpinningWeb } from '../components/SpinningWeb'
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
/**
 * How long the web stays up, at least.
 *
 * A local server answers in under a second, which reads as a flicker rather than as work — and a
 * flicker is worse than no animation at all. The keyframes run on a 2.6s loop, so this is two whole
 * turns: it lands on a boundary, with the web faded out, rather than cutting a half-drawn one.
 * Set VITE_SPYDR_MIN_SPIN to watch a longer one while working on it.
 */
const MIN_SPIN_MS = Number(import.meta.env.VITE_SPYDR_MIN_SPIN ?? 5200)

export function Activate() {
  const { activate, licence, openSample, savedSession } = useApp()
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  // A development build points at the site running next door, so the link lands somewhere real.
  const [site, setSite] = useState('https://getspydr.com')

  useEffect(() => {
    void window.spydr?.about().then((info) => info.site && setSite(info.site))
  }, [])

  const shaped = keyLooksValid(key)

  const submit = async (): Promise<void> => {
    if (!shaped || busy) return
    setBusy(true)
    try {
      await activate(key, MIN_SPIN_MS)
    } finally {
      // Only reached when the key was refused: a good one has already replaced this screen.
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

            {busy ? (
              <div className="activate-waiting">
                <SpinningWeb size={104} label="Checking your licence key" />
                <p>Checking your key…</p>
              </div>
            ) : null}

            {busy ? null : (
            <label className="activate-field">
              <span className="mono">Licence key</span>
              <input
                value={key}
                onChange={(e) => setKey(tidyKeyInput(e.target.value))}
                onBlur={() => setKey((current) => (current ? normalizeKey(current) : current))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit()
                }}
                placeholder="SPYDR-XXXXX-XXXXX-XXXXX-XXXXX"
                spellCheck={false}
                autoFocus
              />
            </label>
            )}

            {licence.message && !busy ? <p className="activate-error">{licence.message}</p> : null}

            {busy ? null : (
            <div className="activate-actions">
              <button type="button" className="primary" disabled={!shaped} onClick={() => void submit()}>
                <KeyRound size={14} aria-hidden />
                Activate
              </button>
              <a className="linkish" href={site} target="_blank" rel="noreferrer">
                Get a free key <ExternalLink size={12} aria-hidden />
              </a>
            </div>
            )}
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
            {savedSession ? (
              <p className="activate-kept">
                Your last read of <strong>{savedSession.domain}</strong> is still on this machine, along with its
                timeline. Removing a licence closes the session — it does not delete anything.
              </p>
            ) : null}
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
