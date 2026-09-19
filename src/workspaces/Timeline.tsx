import { AlertTriangle, ArrowRight, History, Minus, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { describeChanges } from '@shared/diff'
import type { TimelineEntry } from '@shared/timeline'
import { EmptyState } from '../components/EmptyState'
import { relativeTime } from '../lib/format'
import { useApp } from '../state'

function Group({ title, icon: Icon, tone, children }: { title: string; icon: typeof Plus; tone: string; children: React.ReactNode }) {
  return (
    <section className="tl-group">
      <h3>
        <Icon size={13} className={`tl-icon ${tone}`} aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Timeline() {
  const { snapshot, settings, select, goTo, setWorkspace } = useApp()
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [detail, setDetail] = useState<TimelineEntry | null>(null)

  const domain = snapshot?.source === 'ldap' ? snapshot.domain : undefined

  useEffect(() => {
    void window.spydr?.timelineList(domain).then((rows) => {
      setEntries(rows)
      setCurrentId((id) => id ?? rows[0]?.id ?? null)
    })
  }, [domain])

  useEffect(() => {
    if (!currentId) {
      setDetail(null)
      return
    }
    void window.spydr?.timelineGet(currentId).then(setDetail)
  }, [currentId])

  /** A read from a different controller than the one before it invites replication artefacts. */
  const dcChanged = useMemo(() => {
    const flagged = new Set<string>()
    const rows = entries ?? []
    for (let i = 0; i < rows.length - 1; i += 1) {
      if (rows[i].dcHost && rows[i + 1].dcHost && rows[i].dcHost !== rows[i + 1].dcHost) flagged.add(rows[i].id)
    }
    return flagged
  }, [entries])

  const recording = settings.privacy.sessionConsent === 'yes'

  // Entries already recorded — including a generated sample — are shown whether or not recording is
  // currently on. Hiding what is already there would only be confusing.
  if (entries && entries.length === 0) {
    return (
      <div className="split-list">
        <EmptyState
          title={recording ? 'Nothing recorded yet' : 'The timeline is not recording'}
          hint={
            recording
              ? 'The first read of a domain becomes the baseline; re-crawl after a change and it appears here. To see what this looks like, Settings ▸ Privacy can generate a sample timeline for contoso.lab.'
              : 'Recording keeps a small record of a directory on disk, so it sits behind the same permission as session restore — turn on “Keep directories on this computer” in Settings ▸ Privacy. To see what it looks like first, the same page can generate a sample timeline for contoso.lab.'
          }
        />
      </div>
    )
  }

  const entry = detail ?? entries?.find((e) => e.id === currentId) ?? null

  return (
    <div className="timeline">
      <div className="tl-list scroll">
        {!recording ? (
          <p className="tl-notice">
            Recording is off, so nothing new is being added. These entries were recorded earlier or generated as a
            sample.
          </p>
        ) : null}
        {(entries ?? []).map((e) => (
          <button
            key={e.id}
            type="button"
            className={e.id === currentId ? 'tl-row active' : 'tl-row'}
            onClick={() => setCurrentId(e.id)}
          >
            <span className="tl-when">
              <strong>{new Date(e.readAt).toLocaleString()}</strong>
              <em>{relativeTime(e.readAt)}</em>
            </span>
            <span className="tl-summary">{e.summary}</span>
            <span className="tl-tags">
              {e.baseline ? <span className="tl-tag">baseline</span> : null}
              {e.source === 'sample' ? <span className="tl-tag sample">sample</span> : null}
              {e.source === 'applied' ? <span className="tl-tag applied">applied</span> : null}
              {dcChanged.has(e.id) ? (
                <span className="tl-tag warn" title="Read from a different controller than the entry before it">
                  <AlertTriangle size={10} aria-hidden /> {e.dcHost}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <div className="tl-detail scroll">
        {!entry ? (
          <EmptyState title="Select a read" hint="Each entry records what changed since the read before it." />
        ) : (
          <>
            <header className="tl-head">
              <h2>{new Date(entry.readAt).toLocaleString()}</h2>
              <p className="muted">
                {entry.domain} · {entry.dcHost || 'unknown controller'} · scope {entry.scope.baseDn}
                {entry.scope.includeComputers ? '' : ' · computers excluded'}
              </p>
              <p className="tl-score">
                {entry.detail ? describeChanges(entry.detail) : entry.summary}
                {entry.scoreBefore !== entry.scoreAfter ? (
                  <span className={entry.scoreAfter > entry.scoreBefore ? 'up' : 'down'}>
                    {' '}
                    score {entry.scoreBefore} <ArrowRight size={11} aria-hidden /> {entry.scoreAfter}
                  </span>
                ) : null}
              </p>
              {dcChanged.has(entry.id) ? (
                <p className="tl-warn">
                  <AlertTriangle size={13} aria-hidden />
                  This read came from a different domain controller than the one before it. Some differences may be
                  replication lag rather than real change.
                </p>
              ) : null}
            </header>

            {entry.baseline ? (
              <p className="muted tl-empty">
                The first read of this directory, with nothing before it to compare against. Everything after this is
                measured from here.
              </p>
            ) : !entry.detail ? (
              <p className="muted tl-empty">
                The detail of this entry could not be read — it was encrypted under a different account or keychain.
                The summary above still stands.
              </p>
            ) : (
              <>
                {entry.detail.added.length > 0 ? (
                  <Group title={`${entry.detail.added.length} object${entry.detail.added.length === 1 ? '' : 's'} added`} icon={Plus} tone="add">
                    <ul className="tl-items">
                      {entry.detail.added.map((n) => (
                        <li key={n.id}>
                          <button type="button" onClick={() => { select(n.id); goTo('directory', n.id) }}>
                            {n.displayName}
                          </button>
                          <span className="muted">{n.dn}</span>
                        </li>
                      ))}
                    </ul>
                  </Group>
                ) : null}

                {entry.detail.removed.length > 0 ? (
                  <Group title={`${entry.detail.removed.length} object${entry.detail.removed.length === 1 ? '' : 's'} removed`} icon={Minus} tone="remove">
                    <ul className="tl-items">
                      {entry.detail.removed.map((n) => (
                        <li key={n.id}>
                          <span className="gone">{n.displayName}</span>
                          <span className="muted">{n.dn}</span>
                        </li>
                      ))}
                    </ul>
                  </Group>
                ) : null}

                {entry.detail.changed.length > 0 ? (
                  <Group title={`${entry.detail.changed.length} object${entry.detail.changed.length === 1 ? '' : 's'} changed`} icon={History} tone="change">
                    <ul className="tl-items">
                      {entry.detail.changed.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => { select(c.id); goTo('directory', c.id) }}>
                            {c.name}
                          </button>
                          <span className="muted">{c.changes.join(', ')}</span>
                        </li>
                      ))}
                    </ul>
                  </Group>
                ) : null}

                {entry.detail.membershipsAdded.length > 0 ? (
                  <Group title={`${entry.detail.membershipsAdded.length} membership${entry.detail.membershipsAdded.length === 1 ? '' : 's'} added`} icon={Plus} tone="add">
                    <ul className="tl-items">
                      {entry.detail.membershipsAdded.map((m) => (
                        <li key={`${m.fromId}>${m.toId}`}>
                          <span className="tl-edge">
                            {m.fromName} <ArrowRight size={11} aria-hidden /> {m.toName}
                          </span>
                          {m.via === 'primaryGroup' ? <span className="muted">primary group</span> : null}
                        </li>
                      ))}
                    </ul>
                  </Group>
                ) : null}

                {entry.detail.membershipsRemoved.length > 0 ? (
                  <Group title={`${entry.detail.membershipsRemoved.length} membership${entry.detail.membershipsRemoved.length === 1 ? '' : 's'} removed`} icon={Minus} tone="remove">
                    <ul className="tl-items">
                      {entry.detail.membershipsRemoved.map((m) => (
                        <li key={`${m.fromId}>${m.toId}`}>
                          <span className="tl-edge gone">
                            {m.fromName} <ArrowRight size={11} aria-hidden /> {m.toName}
                          </span>
                          {m.via === 'primaryGroup' ? <span className="muted">primary group</span> : null}
                        </li>
                      ))}
                    </ul>
                  </Group>
                ) : null}

                {entry.detail.findingsOpened.length > 0 ? (
                  <Group title={`${entry.detail.findingsOpened.length} finding${entry.detail.findingsOpened.length === 1 ? '' : 's'} opened`} icon={ShieldAlert} tone="remove">
                    <ul className="tl-items">
                      {entry.detail.findingsOpened.map((f) => (
                        <li key={f.id}>
                          <span className={`badge ${f.severity}`}>{f.severity}</span>
                          <span>{f.title}</span>
                          <span className="muted">{f.detail}</span>
                        </li>
                      ))}
                    </ul>
                  </Group>
                ) : null}

                {entry.detail.findingsClosed.length > 0 ? (
                  <Group title={`${entry.detail.findingsClosed.length} finding${entry.detail.findingsClosed.length === 1 ? '' : 's'} closed`} icon={ShieldCheck} tone="add">
                    <ul className="tl-items">
                      {entry.detail.findingsClosed.map((f) => (
                        <li key={f.id}>
                          <span className={`badge ${f.severity}`}>{f.severity}</span>
                          <span>{f.title}</span>
                        </li>
                      ))}
                    </ul>
                  </Group>
                ) : null}
              </>
            )}

            <footer className="tl-foot">
              <span className="muted">
                A record of what differed between reads — not an audit log. It cannot say who made a change, or what
                happened between two reads.
              </span>
              <button type="button" className="linkish" onClick={() => setWorkspace('settings')}>
                <Trash2 size={12} aria-hidden /> Manage history
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
