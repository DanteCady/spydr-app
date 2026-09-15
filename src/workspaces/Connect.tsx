import { useEffect, useMemo, useState } from 'react'
import type { ConnectionInput, Protocol } from '@shared/types'
import { WidowMark } from '../components/WidowMark'
import { useApp } from '../state'

function defaultPort(protocol: Protocol): number {
  return protocol === 'ldaps' ? 636 : 389
}

export function Connect() {
  const { openSample, ingestLdap } = useApp()
  const [domain, setDomain] = useState('')
  const [host, setHost] = useState('')
  const [protocol, setProtocol] = useState<Protocol>('ldaps')
  const [port, setPort] = useState(636)
  const [bindUsername, setBindUsername] = useState('')
  const [password, setPassword] = useState('')
  const [baseDn, setBaseDn] = useState('')
  const [trustServerCert, setTrustServerCert] = useState(false)
  const [busy, setBusy] = useState<'test' | 'ingest' | 'discover' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const desktop = Boolean(window.spydr?.ingest)

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
      setError('Run Spydr as the desktop app to discover DCs.')
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
      setError('Run Spydr as the desktop app to bind to Active Directory.')
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

  return (
    <div className="connect">
      <div className="connect-card">
        <div className="connect-brand">
          <WidowMark size={40} />
          <h1>Spydr</h1>
        </div>
        <p className="lede">Read-only explorer for messy on-prem Active Directory. Sample forest always works. Bind with a normal domain user — not Domain Admin.</p>
        <button className="primary" type="button" onClick={openSample}>
          Open sample directory
        </button>
        <p className="note">contoso.lab — nested groups, a membership cycle, stale and disabled users, a path into Domain Admins.</p>
        <fieldset>
          <legend>Connect to Active Directory</legend>
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
          <button className="ghost" type="button" disabled={busy !== null || !domain} onClick={() => void discover()}>
            {busy === 'discover' ? 'Discovering…' : 'Find DCs from domain'}
          </button>
          <button className="ghost" type="button" disabled={busy !== null || !host || !bindUsername} onClick={() => void test()}>
            {busy === 'test' ? 'Testing…' : 'Test connection'}
          </button>
          <button className="ghost" type="button" disabled={busy !== null || !host || !bindUsername} onClick={() => void ingest()}>
            {busy === 'ingest' ? 'Ingesting…' : 'Ingest directory'}
          </button>
          {!desktop ? <p className="note">Bind and ingest run in the Electron app. This browser preview can still open the sample directory.</p> : null}
          {ok ? <p className="ok">{ok}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </fieldset>
      </div>
    </div>
  )
}
