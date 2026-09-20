import {
  Download,
  KeyRound,
  Sparkles,
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
import { describeLicence, keyLooksValid, normalizeKey, tidyKeyInput } from '@shared/license'
import { LIMITS, type AboutInfo } from '@shared/settings'
import type { TelemetryPayload } from '@shared/telemetry'
import type { FindingType } from '@shared/types'
import type { UpdateCheck } from '../vite-env'
import { ThemeMenu } from '../components/ThemeMenu'
import { useApp } from '../state'

type SectionId = 'hygiene' | 'connection' | 'reports' | 'privacy' | 'appearance' | 'licence' | 'about'

const SECTIONS: { id: SectionId; label: string; Icon: typeof Info }[] = [
  { id: 'hygiene', label: 'Hygiene rules', Icon: SlidersHorizontal },
  { id: 'connection', label: 'Connection', Icon: Plug },
  { id: 'reports', label: 'Reports', Icon: FileText },
  { id: 'privacy', label: 'Privacy & session', Icon: ShieldCheck },
  { id: 'appearance', label: 'Appearance', Icon: Eye },
  { id: 'licence', label: 'Licence', Icon: KeyRound },
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

/** One sentence for whatever the updater is currently doing. */
function describeUpdate(update: UpdateCheck): string {
  switch (update.status) {
    case 'unconfigured':
      return update.error ?? 'Updates are not available in this build.'
    case 'checking':
      return 'Checking…'
    case 'current':
      return `Up to date — running ${update.current}.`
    case 'available':
      return `${update.latest} is available. You are running ${update.current}.`
    case 'ready':
      return `${update.latest} is ready. It installs when you close SPYDIR, or restart now.`
    case 'downloading':
      return ''
    case 'error':
      return update.error ?? 'Could not check for updates.'
  }
}

export function Settings() {
  const { settings, updateSettings, resetSettings, snapshot, forgetSession, savedSession, licence, activate, deactivate } =
    useApp()
  const [section, setSection] = useState<SectionId>('hygiene')
  const [about, setAbout] = useState<AboutInfo | null>(null)
  const [update, setUpdate] = useState<UpdateCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [groupDraft, setGroupDraft] = useState('')
  const [historyStats, setHistoryStats] = useState<{ entries: number; path: string } | null>(null)
  const [sampleNote, setSampleNote] = useState<string | null>(null)
  const [keyDraft, setKeyDraft] = useState('')
  const [licenceBusy, setLicenceBusy] = useState(false)
  const [payload, setPayload] = useState<TelemetryPayload | null>(null)
  const [sendNote, setSendNote] = useState<string | null>(null)

  useEffect(() => {
    void window.spydir?.about().then(setAbout)
    void window.spydir?.timelineStats().then(setHistoryStats)
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

  // The updater pushes progress while a download runs, so the panel follows it rather than
  // freezing on whatever the last request happened to return.
  useEffect(() => {
    setUpdate(window.spydir?.updateState() ?? null)
    return window.spydir?.onUpdate(setUpdate)
  }, [])

  const checkUpdates = async () => {
    setChecking(true)
    try {
      setUpdate((await window.spydir?.checkForUpdate()) ?? null)
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
              SPYDIR does not need to read the domain controller again.
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
              SPYDIR reads the directory and nothing else. Nothing is sent anywhere, no telemetry is collected, and
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
                label="Forget the saved session when SPYDIR closes"
                onChange={(v) => updateSettings({ privacy: { forgetOnQuit: v } })}
              />
            </Row>
            <Row
              label="Usage telemetry"
              hint="Off by default. Anonymous counts only — never a domain, an object or a name."
            >
              <Toggle
                checked={privacy.telemetry}
                label={privacy.telemetry ? 'On' : 'Off'}
                onChange={(v) => updateSettings({ privacy: { telemetry: v } })}
              />
            </Row>
            <Row
              label="What would be sent"
              hint={
                privacy.telemetryLastSent
                  ? `Last sent ${new Date(privacy.telemetryLastSent).toLocaleString()}`
                  : 'Nothing has been sent from this machine.'
              }
            >
              <span className="stack">
                <button
                  type="button"
                  onClick={() => {
                    if (payload) {
                      setPayload(null)
                      return
                    }
                    void window.spydir?.telemetryPreview().then(setPayload)
                  }}
                >
                  {payload ? 'Hide payload' : 'Show payload'}
                </button>
                {privacy.telemetry ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSendNote('Sending…')
                      void window.spydir?.telemetrySend().then((r) => setSendNote(r.message))
                    }}
                  >
                    Send one now
                  </button>
                ) : null}
                {sendNote ? <span className="muted">{sendNote}</span> : null}
              </span>
            </Row>
            {payload ? <pre className="payload">{JSON.stringify(payload, null, 2)}</pre> : null}
            <Row label="Change history" hint="How long the timeline keeps entries. Zero keeps everything.">
              <NumberField
                value={privacy.historyRetentionDays}
                bounds={LIMITS.historyRetentionDays}
                suffix="days"
                onChange={(n) => updateSettings({ privacy: { historyRetentionDays: n } })}
              />
            </Row>
            <Row label="Timeline entries" hint={historyStats ? `Stored at ${historyStats.path}` : 'Counting…'}>
              <span className="stack">
                <span className="muted">{historyStats ? `${historyStats.entries} recorded` : '—'}</span>
                <button
                  type="button"
                  className="danger"
                  disabled={!historyStats?.entries}
                  onClick={() => {
                    void window.spydir?.timelineClear().then(() => window.spydir?.timelineStats().then(setHistoryStats))
                  }}
                >
                  Clear history
                </button>
              </span>
            </Row>
            <Row
              label="Sample timeline"
              hint="Six weeks of invented changes to contoso.lab, computed by the same rules a real read uses. Marked as sample, and removed by Clear history."
            >
              <span className="stack">
                <button
                  type="button"
                  onClick={() => {
                    // A running app whose background process predates the feature has no handler to
                    // call; saying so beats a button that silently does nothing.
                    if (!window.spydir?.timelineSample) {
                      setSampleNote('Unavailable in this running build — restart SPYDIR.')
                      return
                    }
                    setSampleNote('Generating…')
                    window.spydir
                      .timelineSample()
                      .then((r) => {
                        setSampleNote(`${r.created} entries created${r.replaced ? `, ${r.replaced} replaced` : ''}`)
                        void window.spydir?.timelineStats().then(setHistoryStats)
                      })
                      .catch((err: unknown) => {
                        setSampleNote(err instanceof Error ? err.message : 'Could not generate the sample timeline.')
                      })
                  }}
                >
                  <Sparkles size={13} aria-hidden /> Generate
                </button>
                {sampleNote ? <span className="muted">{sampleNote}</span> : null}
              </span>
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

        {section === 'licence' ? (
          <>
            <h2>Licence</h2>
            <p className="set-intro">
              SPYDIR is free. The key exists so there is a count of who is using it, and somewhere for paid capability
              to attach later. It is checked when you enter it and about once a month after that — and if that check
              falls due while you are offline, SPYDIR keeps working and says so rather than locking you out mid-incident.
            </p>
            <Row label="Status">
              <span className="muted">{describeLicence(licence)}</span>
            </Row>
            {licence.status === 'active' || licence.status === 'grace' ? (
              <>
                <Row label="Key">
                  <span className="muted mono-hint">{licence.keyHint}</span>
                </Row>
                <Row label="Tier" hint="Free carries every feature SPYDIR has today.">
                  <span className="muted">{licence.tier}</span>
                </Row>
                <Row label="Checked" hint={licence.notAfter ? `Next check due ${new Date(licence.notAfter).toLocaleDateString()}` : undefined}>
                  <span className="muted">
                    {licence.checkedAt ? new Date(licence.checkedAt).toLocaleString() : '—'}
                  </span>
                </Row>
                <Row label="Remove this licence" hint="The key is deleted from this machine. Nothing is sent.">
                  <button
                    type="button"
                    className="danger"
                    disabled={licenceBusy}
                    onClick={() => {
                      setLicenceBusy(true)
                      void deactivate().finally(() => setLicenceBusy(false))
                    }}
                  >
                    Deactivate
                  </button>
                </Row>
              </>
            ) : (
              <Row label="Licence key" hint={`Issued when you sign up at ${about?.site ?? 'spydir.io'}.`}>
                <span className="stack">
                  <input
                    className="wide"
                    value={keyDraft}
                    placeholder="SPYDIR-XXXXX-XXXXX-XXXXX-XXXXX"
                    spellCheck={false}
                    onChange={(e) => setKeyDraft(tidyKeyInput(e.target.value))}
                    onBlur={() => setKeyDraft((current) => (current ? normalizeKey(current) : current))}
                  />
                  <button
                    type="button"
                    disabled={licenceBusy || !keyLooksValid(keyDraft)}
                    onClick={() => {
                      setLicenceBusy(true)
                      void activate(keyDraft).finally(() => setLicenceBusy(false))
                    }}
                  >
                    {licenceBusy ? 'Checking…' : 'Activate'}
                  </button>
                </span>
              </Row>
            )}
            {licence.message ? <p className="set-intro danger-text">{licence.message}</p> : null}
          </>
        ) : null}

        {section === 'about' ? (
          <>
            <h2>About SPYDIR</h2>
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
              SPYDIR checks for updates only when you give it a feed to ask, and it never installs anything on its own —
              it tells you what is out there and links to it. A GitHub releases API URL works as-is.
            </p>
            <Row label="Update feed" hint="Leave empty to use the published releases. Set it to mirror them internally.">
              <input
                className="wide"
                value={updates.feedUrl}
                placeholder="https://github.com/DanteCady/spydr-app/releases/latest/download"
                onChange={(e) => updateSettings({ updates: { feedUrl: e.target.value } })}
              />
            </Row>
            <Row label="On start">
              <Toggle
                checked={updates.checkOnStart}
                label="Check when SPYDIR opens"
                onChange={(v) => updateSettings({ updates: { checkOnStart: v } })}
              />
            </Row>
            <Row
              label="Download automatically"
              hint="Off by default. Either way nothing is installed until you close SPYDIR, so a directory read is never interrupted."
            >
              <Toggle
                checked={updates.automatic}
                label="Fetch updates without asking"
                onChange={(v) => updateSettings({ updates: { automatic: v } })}
              />
            </Row>
            <Row label="Updates">
              <span className="stack">
                <span className="update-actions">
                  <button
                    type="button"
                    onClick={() => void checkUpdates()}
                    disabled={checking || update?.status === 'downloading'}
                  >
                    <Download size={13} aria-hidden /> {checking ? 'Checking…' : 'Check for updates'}
                  </button>
                  {update?.status === 'available' ? (
                    <button type="button" className="primary" onClick={() => void window.spydir?.downloadUpdate()}>
                      Download {update.latest}
                    </button>
                  ) : null}
                  {update?.status === 'ready' ? (
                    <button type="button" className="primary" onClick={() => void window.spydir?.installUpdate()}>
                      Restart and install
                    </button>
                  ) : null}
                </span>

                {update?.status === 'downloading' ? (
                  <span className="update-progress">
                    <progress max={100} value={update.progress ?? 0} />
                    <span className="muted">
                      Downloading {update.latest} — {update.progress ?? 0}%
                    </span>
                  </span>
                ) : null}

                {update && update.status !== 'downloading' ? (
                  <span className="muted">{describeUpdate(update)}</span>
                ) : null}
              </span>
            </Row>
          </>
        ) : null}
      </div>
    </div>
  )
}
