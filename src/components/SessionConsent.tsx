import { HardDrive } from 'lucide-react'
import { useApp } from '../state'

/**
 * Asked once, the first time a live directory is open. SPYDR would otherwise write a full copy of
 * someone's Active Directory to disk without ever saying so — encrypted, but unannounced.
 */
export function SessionConsent() {
  const { needsSessionConsent, setSessionConsent } = useApp()
  if (!needsSessionConsent) return null

  return (
    <div className="consent-bar" role="region" aria-label="Session storage">
      <HardDrive size={15} aria-hidden />
      <div className="consent-text">
        <strong>Keep this directory on this computer?</strong>
        <span className="muted">
          Session restore and the change timeline both need SPYDR to keep a record of this directory on disk —
          compressed, and encrypted with the OS keychain where one exists. Nothing is sent anywhere. Passwords are
          never written.
        </span>
      </div>
      <button type="button" className="linkish" onClick={() => setSessionConsent('no')}>
        No, this session only
      </button>
      <button type="button" className="consent-yes" onClick={() => setSessionConsent('yes')}>
        Keep it
      </button>
    </div>
  )
}
