import { CircleHelp, DatabaseZap, FolderOpen, History, Plug, Radar, Settings2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ConnectionInput, Protocol } from '@shared/types'
import { WidowMark } from '../components/WidowMark'
import { useApp } from '../state'

function defaultPort(protocol: Protocol): number {
  return protocol === 'ldaps' ? 636 : 389
}

export function Connect() {
  const { openSample, ingestLdap, savedSession, restoreSession, forgetSession, settings, setWorkspace, openHelp } =
    useApp()
  // Settings supply the starting point; a saved profile below still wins over them.
  const defaults = useRef(settings.connection).current
  const [domain, setDomain] = useState('')
  const [host, setHost] = useState('')
  const [protocol, setProtocol] = useState<Protocol>(defaults.defaultProtocol)
  const [port, setPort] = useState(defaultPort(defaults.defaultProtocol))
  const [bindUsername, setBindUsername] = useState('')
  const [password, setPassword] = useState('')
  const [baseDn, setBaseDn] = useState('')
  const [trustServerCert, setTrustServerCert] = useState(defaults.trustServerCert)
  const [busy, setBusy] = useState<'test' | 'ingest' | 'discover' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const desktop = Boolean(window.spydr?.ingest)

  // A restored profile is a better prefill than the Windows environment, so it wins.
  useEffect(() => {
    const p = savedSession?.profile
    if (!p) return
    setDomain((d) => d || p.domain)
    setHost((h) => h || p.host)
    setProtocol(p.protocol)
    setPort(p.port)
    setBindUsername((u) => u || p.bindUsername)
    setBaseDn((b) => b || p.baseDn)
    setTrustServerCert(p.trustServerCert)
  }, [savedSession])

  useEffect(() => {
    if (!window.spydr?.windowsPrefill) return
    void window.spydr.windowsPrefill().then((p) => {
      if (p.domain) setDomain((d) => d || p.domain || '')
      if (p.host) setHost((h) => h || p.host || '')
    })
  }, [])

  const input: ConnectionInput = useMemo(
    () => ({
      domain,
      host,
      port,
      protocol,
      bindUsername,
      password,
      trustServerCert,
      baseDn,
      rememberPassword: false
    }),
    [domain, host, port, protocol, bindUsername, password, trustServerCert, baseDn]
  )

  async function discover(): Promise<void> {
    if (!window.spydr?.discoverDcs) {
      setError('Run SPYDR as the desktop app to discover DCs.')
      return
    }
    setBusy('discover')
    setError(null)
    try {
      const dcs = await window.spydr.discoverDcs(domain)
      if (dcs.length === 0) {
        setError('No LDAP SRV records. Paste the DC hostname or IP (split-DNS is often broken on VPN).')
        return
      }
      setHost(dcs[0].name)
      if (protocol === 'ldap' || protocol === 'starttls') setPort(dcs[0].port || 389)
      setOk(`Found ${dcs.length} DC${dcs.length === 1 ? '' : 's'}: ${dcs.map((d) => d.name).join(', ')}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function test(): Promise<void> {
    if (!window.spydr?.testConnection) {
      setError('Run SPYDR as the desktop app to bind to Active Directory.')
      return
    }
    setBusy('test')
    setError(null)
    setOk(null)
    try {
      const result = await window.spydr.testConnection(input)
      if (!baseDn) setBaseDn(result.defaultNamingContext)
      setOk(`Bound as ${result.boundAs} on ${result.dnsHostName}. Base DN ${result.defaultNamingContext}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function ingest(): Promise<void> {
    setBusy('ingest')
    setError(null)
    try {
      await ingestLdap(input)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(null)
    }
  }

  const canBind = Boolean(host && bindUsername)

  return (
    <div className="welcome">
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

        <div className="welcome-cols">
          <section className="welcome-col">
            <h2>Start</h2>
            <button type="button" className="welcome-action" onClick={() => setShowForm((on) => !on)} aria-expanded={showForm}>
              <Plug size={16} aria-hidden />
              <span>
                <strong>Connect to a domain</strong>
                <em>Bind to a live domain controller over LDAPS</em>
              </span>
            </button>
            <button type="button" className="welcome-action" onClick={openSample}>
              <FolderOpen size={16} aria-hidden />
              <span>
                <strong>Open sample directory</strong>
                <em>See how SPYDR works</em>
              </span>
            </button>
            {savedSession ? (
              <button type="button" className="welcome-action" onClick={() => void restoreSession()}>
                <History size={16} aria-hidden />
                <span>
                  <strong>Restore last session</strong>
                  <em>Reopen {savedSession.domain} without binding again</em>
                </span>
              </button>
            ) : null}
            <button type="button" className="welcome-action" onClick={() => setWorkspace('settings')}>
              <Settings2 size={16} aria-hidden />
              <span>
                <strong>Settings</strong>
                <em>Hygiene thresholds, connection defaults, privacy</em>
              </span>
            </button>
            <button type="button" className="welcome-action" onClick={() => openHelp('start')}>
              <CircleHelp size={16} aria-hidden />
              <span>
                <strong>Guide</strong>
                <em>What the fields mean, what the findings mean, what SPYDR never does</em>
              </span>
            </button>
          </section>

          <section className="welcome-col">
            <h2>Recent</h2>
            {savedSession ? (
              <div className="recent-item">
                <button type="button" className="recent-open" onClick={() => void restoreSession()}>
                  <strong>{savedSession.domain}</strong>
                  <span className="muted">
                    {savedSession.stats.users} users · {savedSession.stats.groups} groups · {savedSession.stats.findings} findings
                  </span>
                  <span className="muted">
                    {savedSession.source === 'fixture' ? 'Sample directory' : savedSession.dcHost} ·{' '}
                    {new Date(savedSession.savedAt).toLocaleString()}
                  </span>
                </button>
                <button type="button" className="recent-forget" title="Forget this session" onClick={() => void forgetSession()}>
                  <X size={14} aria-hidden />
                </button>
              </div>
            ) : (
              <p className="welcome-empty">Nothing yet. A directory you open is offered back here.</p>
            )}
          </section>
        </div>

        {showForm ? (
          <section className="welcome-form">
            <h2>Connect to Active Directory</h2>
            <div className="row">
              <label>
                Domain FQDN
                <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="corp.example.com" />
              </label>
              <label>
                Domain controller
                <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="dc01.corp.example.com" />
              </label>
            </div>
            <div className="row">
              <label>
                Protocol
                <select
                  value={protocol}
                  onChange={(e) => {
                    const next = e.target.value as Protocol
                    setProtocol(next)
                    setPort(defaultPort(next))
                  }}
                >
                  <option value="ldaps">LDAPS (636)</option>
                  <option value="ldap">LDAP (389)</option>
                  <option value="starttls">StartTLS (389)</option>
                </select>
              </label>
              <label>
                Port
                <input type="number" value={port} onChange={(e) => setPort(Number(e.target.value))} />
              </label>
            </div>
            <div className="row">
              <label>
                User (UPN or DOMAIN\user)
                <input value={bindUsername} onChange={(e) => setBindUsername(e.target.value)} placeholder="lee@corp.example.com" />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
              </label>
            </div>
            <div className="row">
              <label>
                Base DN (blank = rootDSE)
                <input value={baseDn} onChange={(e) => setBaseDn(e.target.value)} placeholder="DC=corp,DC=example,DC=com" />
              </label>
              <label className="check">
                <input type="checkbox" checked={trustServerCert} onChange={(e) => setTrustServerCert(e.target.checked)} />
                Trust this server’s certificate (lab / self-signed)
              </label>
            </div>
            <div className="welcome-form-actions">
              <button type="button" className="ghost" disabled={busy !== null || !domain} onClick={() => void discover()}>
                <Radar size={14} aria-hidden /> {busy === 'discover' ? 'Discovering…' : 'Find DCs'}
              </button>
              <button type="button" className="ghost" disabled={busy !== null || !canBind} onClick={() => void test()}>
                <Plug size={14} aria-hidden /> {busy === 'test' ? 'Testing…' : 'Test connection'}
              </button>
              <button type="button" className="primary" disabled={busy !== null || !canBind} onClick={() => void ingest()}>
                <DatabaseZap size={14} aria-hidden /> {busy === 'ingest' ? 'Ingesting…' : 'Ingest directory'}
              </button>
            </div>
            {!desktop ? <p className="note">Bind and ingest run in the Electron app. This browser preview can still open the sample directory.</p> : null}
            {ok ? <p className="ok">{ok}</p> : null}
            {error ? <p className="error">{error}</p> : null}
          </section>
        ) : null}

        <p className="welcome-foot">Bind with a normal domain user — not Domain Admin. SPYDR never writes to the directory.</p>
      </div>
    </div>
  )
}
