import {
  Download,
  Eye,
  FileText,
  Info,
  Plug,
  ShieldCheck,
  SlidersHorizontal,
  X
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { RULES } from '@shared/engine/registry'
import { LIMITS, type AboutInfo } from '@shared/settings'
import type { FindingType } from '@shared/types'
import type { UpdateCheck } from '../vite-env'
import { ThemeMenu } from '../components/ThemeMenu'
import { useApp } from '../state'

type SectionId = 'hygiene' | 'connection' | 'reports' | 'privacy' | 'appearance' | 'about'

const SECTIONS: { id: SectionId; label: string; Icon: typeof Info }[] = [
  { id: 'hygiene', label: 'Hygiene rules', Icon: SlidersHorizontal },
  { id: 'connection', label: 'Connection', Icon: Plug },
  { id: 'reports', label: 'Reports', Icon: FileText },
  { id: 'privacy', label: 'Privacy & session', Icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', Icon: Eye },
  { id: 'about', label: 'About & updates', Icon: Info }
]

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-label">
        <span>{label}</span>
        {hint ? <em>{hint}</em> : null}
      </div>
      <div className="set-control">{children}</div>
    </div>
  )
}

function NumberField({
  value,
  bounds,
  suffix,
  onChange
}: {
  value: number
  bounds: { min: number; max: number }
  suffix?: string
  onChange: (n: number) => void
}) {
  return (
    <span className="num-field">
      <input
        type="number"
        value={value}
        min={bounds.min}
        max={bounds.max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
      {suffix ? <span className="suffix">{suffix}</span> : null}
    </span>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="set-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}

export function Settings() {
  const { settings, updateSettings, resetSettings, snapshot, forgetSession, savedSession } = useApp()
  const [section, setSection] = useState<SectionId>('hygiene')
  const [about, setAbout] = useState<AboutInfo | null>(null)
  const [update, setUpdate] = useState<UpdateCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [groupDraft, setGroupDraft] = useState('')

  useEffect(() => {
    void window.spydr?.about().then(setAbout)
  }, [])

  const { hygiene, connection, report, privacy, appearance, updates } = settings

  const toggleRule = (id: FindingType, enabled: boolean) => {
    const next = enabled ? hygiene.disabledRules.filter((r) => r !== id) : [...hygiene.disabledRules, id]
    updateSettings({ hygiene: { disabledRules: next } })
  }

  const addGroup = () => {
    const name = groupDraft.trim()
    if (!name) return
    updateSettings({ hygiene: { privilegedGroups: [...hygiene.privilegedGroups, name] } })
    setGroupDraft('')
  }

  const checkUpdates = async () => {
    setChecking(true)
    try {
      setUpdate((await window.spydr?.checkForUpdate()) ?? null)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="settings">
      <nav className="set-nav">
        {SECTIONS.map(({ id, label, Icon }) => (
          <button key={id} type="button" className={section === id ? 'active' : ''} onClick={() => setSection(id)}>
            <Icon size={15} aria-hidden />
            {label}
          </button>
        ))}
        <span className="set-nav-gap" />
        <button type="button" className="set-reset" onClick={resetSettings}>
          Restore defaults
        </button>
      </nav>

      <div className="set-body scroll">
        {section === 'hygiene' ? (
          <>
            <h2>Hygiene rules</h2>
            <p className="set-intro">
              Thresholds the rules are measured against. Changing one re-scores the directory that is already open —
              SPYDR does not need to read the domain controller again.
            </p>
            <Row label="Stale after" hint="Days without a logon before an account counts as stale.">
              <NumberField
                value={hygiene.staleDays}
                bounds={LIMITS.staleDays}
                suffix="days"
                onChange={(n) => updateSettings({ hygiene: { staleDays: n } })}
              />
            </Row>
            <Row label="Nesting limit" hint="Groups deeper than this are flagged.">
              <NumberField
                value={hygiene.deepNesting}
                bounds={LIMITS.deepNesting}
                suffix="levels"
                onChange={(n) => updateSettings({ hygiene: { deepNesting: n } })}
              />
            </Row>
            <Row label="Privileged paths" hint="Nested paths enumerated per user and privileged group.">
              <NumberField
                value={hygiene.maxPrivilegedPaths}
                bounds={LIMITS.maxPrivilegedPaths}
                suffix="max"
                onChange={(n) => updateSettings({ hygiene: { maxPrivilegedPaths: n } })}
              />
            </Row>

            <h3>Your privileged groups</h3>
            <p className="set-intro">
              Domain Admins, Enterprise Admins, Schema Admins and Administrators are always treated as privileged. Add
              the Tier-0 groups your forest actually uses.
            </p>
            <div className="chip-row">
              {hygiene.privilegedGroups.map((name) => (
                <span className="token" key={name}>
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name}`}
                    onClick={() =>
                      updateSettings({ hygiene: { privilegedGroups: hygiene.privilegedGroups.filter((g) => g !== name) } })
                    }
                  >
                    <X size={11} aria-hidden />
                  </button>
                </span>
              ))}
              {hygiene.privilegedGroups.length === 0 ? <span className="muted">None added.</span> : null}
            </div>
            <div className="token-add">
              <input
                value={groupDraft}
                placeholder="sAMAccountName, e.g. Tier0-Admins"
                onChange={(e) => setGroupDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addGroup()
                }}
              />
              <button type="button" onClick={addGroup}>
                Add
              </button>
            </div>

            <h3>Rules</h3>
            <div className="rule-list">
              {RULES.map((rule) => (
                <label key={rule.id} className="rule-item">
                  <input
                    type="checkbox"
                    checked={!hygiene.disabledRules.includes(rule.id)}
                    onChange={(e) => toggleRule(rule.id, e.target.checked)}
                  />
                  <span>
                    <strong>{rule.name}</strong>
                    <em>{rule.describe}</em>
                  </span>
                  <span className={`badge ${rule.severity}`}>{rule.severity}</span>
                </label>
              ))}
            </div>
          </>
        ) : null}

        {section === 'connection' ? (
          <>
            <h2>Connection</h2>
            <p className="set-intro">
              Defaults for the Connect screen and the limits the ingest runs under. Lower the page size if a domain
              controller enforces a small MaxPageSize.
            </p>
            <Row label="Default protocol">
              <select
                value={connection.defaultProtocol}
                onChange={(e) =>
                  updateSettings({ connection: { defaultProtocol: e.target.value as typeof connection.defaultProtocol } })
                }
              >
                <option value="ldaps">LDAPS (636)</option>
                <option value="ldap">LDAP (389)</option>
                <option value="starttls">StartTLS (389)</option>
              </select>
            </Row>
            <Row label="Trust self-signed certificates" hint="Only the default for new connections; each one can differ.">
              <Toggle
                checked={connection.trustServerCert}
                label="Offer trust by default"
                onChange={(v) => updateSettings({ connection: { trustServerCert: v } })}
              />
            </Row>
            <Row label="Page size" hint="Entries per LDAP page.">
              <NumberField
                value={connection.pageSize}
                bounds={LIMITS.pageSize}
                onChange={(n) => updateSettings({ connection: { pageSize: n } })}
              />
            </Row>
            <Row label="Search timeout">
              <NumberField
                value={connection.searchTimeout}
                bounds={LIMITS.searchTimeout}
                suffix="sec"
                onChange={(n) => updateSettings({ connection: { searchTimeout: n } })}
              />
            </Row>
            <Row label="Connect timeout">
              <NumberField
                value={connection.connectTimeout}
                bounds={LIMITS.connectTimeout}
                suffix="sec"
                onChange={(n) => updateSettings({ connection: { connectTimeout: n } })}
              />
            </Row>
            <Row label="What to read" hint="Computers can be half a large directory and hold no membership of their own.">
              <div className="stack">
                <Toggle
                  checked={connection.includeComputers}
                  label="Computers"
                  onChange={(v) => updateSettings({ connection: { includeComputers: v } })}
                />
                <Toggle
                  checked={connection.includeContainers}
                  label="System containers"
                  onChange={(v) => updateSettings({ connection: { includeContainers: v } })}
                />
              </div>
            </Row>
          </>
        ) : null}

        {section === 'reports' ? (
          <>
            <h2>Reports</h2>
            <p className="set-intro">How the PDF is laid out and what happens once it is written.</p>
            <Row label="Paper size">
              <select
                value={report.paper}
                onChange={(e) => updateSettings({ report: { paper: e.target.value as typeof report.paper } })}
              >
                <option value="Letter">Letter (8.5 × 11 in)</option>
                <option value="A4">A4 (210 × 297 mm)</option>
              </select>
            </Row>
            <Row label="Findings per rule" hint="The rest are summarised as a count at the end of the section.">
              <NumberField
                value={report.perSection}
                bounds={LIMITS.perSection}
                onChange={(n) => updateSettings({ report: { perSection: n } })}
              />
            </Row>
            <Row label="Priorities listed" hint="Length of the 'what to fix first' section.">
              <NumberField
                value={report.prioritySection}
                bounds={LIMITS.prioritySection}
                onChange={(n) => updateSettings({ report: { prioritySection: n } })}
              />
            </Row>
            <Row label="After saving">
              <Toggle
                checked={report.openAfterSave}
                label="Open the PDF"
                onChange={(v) => updateSettings({ report: { openAfterSave: v } })}
              />
            </Row>
          </>
        ) : null}

        {section === 'privacy' ? (
          <>
            <h2>Privacy & session</h2>
            <p className="set-intro">
              SPYDR reads the directory and nothing else. Nothing is sent anywhere, no telemetry is collected, and
              passwords are never written to disk.
            </p>
            <Row label="Keep directories on this computer" hint="Needed for Restore last session. Compressed, and encrypted with the OS keychain where one exists.">
              <select
                value={privacy.sessionConsent}
                onChange={(e) => {
                  const value = e.target.value as typeof privacy.sessionConsent
                  updateSettings({ privacy: { sessionConsent: value } })
                  if (value === 'no') void forgetSession()
                }}
              >
                <option value="yes">Keep</option>
                <option value="no">Do not keep</option>
                <option value="unset">Ask me</option>
              </select>
            </Row>
            <Row label="On quit">
              <Toggle
                checked={privacy.forgetOnQuit}
                label="Forget the saved session when SPYDR closes"
                onChange={(v) => updateSettings({ privacy: { forgetOnQuit: v } })}
              />
            </Row>
            <Row label="Saved session" hint={savedSession ? `${savedSession.domain}, saved ${new Date(savedSession.savedAt).toLocaleString()}` : 'Nothing saved.'}>
              <button type="button" className="danger" disabled={!savedSession} onClick={() => void forgetSession()}>
                Forget now
              </button>
            </Row>
          </>
        ) : null}

        {section === 'appearance' ? (
          <>
            <h2>Appearance</h2>
            <Row label="Theme" hint="Also on View ▸ Theme, with a shortcut-free entry per theme.">
              <ThemeMenu variant="inline" />
            </Row>
            <h3>Canvas defaults</h3>
            <p className="set-intro">Where the Web canvas starts each time you open it.</p>
            <Row label="Layout">
              <select
                value={appearance.canvasLayout}
                onChange={(e) =>
                  updateSettings({ appearance: { canvasLayout: e.target.value as typeof appearance.canvasLayout } })
                }
              >
                <option value="tree">Tree</option>
                <option value="structure">Structure</option>
              </select>
            </Row>
            <Row label="Spacing">
              <select
                value={appearance.canvasDensity}
                onChange={(e) =>
                  updateSettings({ appearance: { canvasDensity: e.target.value as typeof appearance.canvasDensity } })
                }
              >
                <option value="auto">Auto</option>
                <option value="compact">Compact</option>
                <option value="spread">Spread</option>
              </select>
            </Row>
            <Row label="Show by default">
              <div className="stack">
                <Toggle
                  checked={appearance.canvasLabels}
                  label="Names on nodes"
                  onChange={(v) => updateSettings({ appearance: { canvasLabels: v } })}
                />
                <Toggle
                  checked={appearance.canvasLegend}
                  label="Legend"
                  onChange={(v) => updateSettings({ appearance: { canvasLegend: v } })}
                />
                <Toggle
                  checked={appearance.canvasGrid}
                  label="Grid"
                  onChange={(v) => updateSettings({ appearance: { canvasGrid: v } })}
                />
              </div>
            </Row>
          </>
        ) : null}

        {section === 'about' ? (
          <>
            <h2>About SPYDR</h2>
            <p className="set-intro">A read-only Active Directory explorer. It never writes to the directory.</p>
            <dl className="kv">
              <dt>Version</dt>
              <dd>{about?.version ?? '—'}{about && !about.packaged ? ' (development build)' : ''}</dd>
              <dt>Electron</dt>
              <dd>{about?.electron ?? '—'}</dd>
              <dt>Chromium</dt>
              <dd>{about?.chrome ?? '—'}</dd>
              <dt>Node</dt>
              <dd>{about?.node ?? '—'}</dd>
              <dt>Platform</dt>
              <dd>{about?.platform ?? '—'}</dd>
              <dt>Settings file</dt>
              <dd><code>{about?.settingsPath ?? '—'}</code></dd>
              <dt>Data folder</dt>
              <dd><code>{about?.userData ?? '—'}</code></dd>
              <dt>Open directory</dt>
              <dd>{snapshot ? `${snapshot.domain} · ${snapshot.stats.findings} findings` : 'None'}</dd>
            </dl>

            <h3>Updates</h3>
            <p className="set-intro">
              SPYDR checks for updates only when you give it a feed to ask, and it never installs anything on its own —
              it tells you what is out there and links to it. A GitHub releases API URL works as-is.
            </p>
            <Row label="Update feed" hint="https only. Leave empty to disable update checks entirely.">
              <input
                className="wide"
                value={updates.feedUrl}
                placeholder="https://api.github.com/repos/owner/repo/releases"
                onChange={(e) => updateSettings({ updates: { feedUrl: e.target.value } })}
              />
            </Row>
            <Row label="On start">
              <Toggle
                checked={updates.checkOnStart}
                label="Check when SPYDR opens"
                onChange={(v) => updateSettings({ updates: { checkOnStart: v } })}
              />
            </Row>
            <Row label="Check now">
              <span className="stack">
                <button type="button" onClick={() => void checkUpdates()} disabled={checking}>
                  <Download size={13} aria-hidden /> {checking ? 'Checking…' : 'Check for updates'}
                </button>
                {update ? (
                  <span className="muted">
                    {update.status === 'unconfigured'
                      ? 'No update feed set, so nothing was contacted.'
                      : update.status === 'current'
                        ? `Up to date — running ${update.current}.`
                        : update.status === 'available'
                          ? `${update.latest} is available (running ${update.current}).`
                          : update.error}
                    {update.status === 'available' && update.url ? (
                      <>
                        {' '}
                        <a href={update.url} target="_blank" rel="noreferrer">
                          Open release
                        </a>
                      </>
                    ) : null}
                  </span>
                ) : null}
              </span>
            </Row>
          </>
        ) : null}
      </div>
    </div>
  )
}
