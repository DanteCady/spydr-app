import { useMemo, useState } from 'react'
import { isSecurityGroup } from '@shared/adFlags'
import { memberOf, membersOf } from '@shared/graph'
import type { DirectoryNode } from '@shared/types'
import { CopyButton } from '../components/CopyButton'
import { EmptyState } from '../components/EmptyState'
import { FindingCard } from '../components/FindingCard'
import { TypeGlyph } from '../components/TypeGlyph'
import { StatusBadges } from '../components/StatusBadges'
import { formatLogon, formatWhen, groupScope, typeLabel, uacSummary } from '../lib/format'
import { useApp } from '../state'

type Tab = 'general' | 'account' | 'memberof' | 'members' | 'object' | 'spydir'

export function ObjectInspector() {
  const { snapshot, selectedId, select, goTo, setPathSource } = useApp()
  const [tab, setTab] = useState<Tab>('general')
  const node = snapshot?.nodes.find((n) => n.id === selectedId) ?? null

  const memberOfIds = useMemo(
    () => (snapshot && node ? memberOf(snapshot.edges, node.id) : []),
    [snapshot, node]
  )
  const memberIds = useMemo(
    () => (snapshot && node ? membersOf(snapshot.edges, node.id) : []),
    [snapshot, node]
  )
  const findings = snapshot?.findings.filter((f) => node && f.objectIds.includes(node.id)) ?? []

  if (!snapshot) return null
  if (!node) {
    return (
      <aside className="split-inspector">
        <EmptyState title="Nothing selected" hint="Select an object in any workspace to inspect its properties, memberships, and findings." />
      </aside>
    )
  }

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'general', label: 'General', show: true },
    { id: 'account', label: 'Account', show: node.type === 'user' },
    { id: 'memberof', label: 'Member Of', show: node.type === 'user' || node.type === 'group' },
    { id: 'members', label: 'Members', show: node.type === 'group' },
    { id: 'object', label: 'Object', show: true },
    { id: 'spydir', label: 'SPYDIR', show: true }
  ]

  const resolve = (id: string): DirectoryNode | undefined => snapshot.nodes.find((n) => n.id === id)

  return (
    <aside className="split-inspector">
      <div className="inspector-head">
        <div className="name-cell">
          <TypeGlyph type={node.type} />
          <h2>{node.displayName}</h2>
        </div>
        <div className="muted">{typeLabel(node.type)}</div>
      </div>
      <div className="tabs">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
      </div>
      <div className="scroll">
        {tab === 'general' ? (
          <dl className="kv">
            <dt>Name</dt>
            <dd>{node.name}</dd>
            <dt>Description</dt>
            <dd>{node.description || '—'}</dd>
            {node.mail ? (
              <>
                <dt>E-mail</dt>
                <dd>{node.mail}</dd>
              </>
            ) : null}
            {node.office ? (
              <>
                <dt>Office</dt>
                <dd>{node.office}</dd>
              </>
            ) : null}
            {node.type === 'group' ? (
              <>
                <dt>Group type</dt>
                <dd>{groupScope(node.groupType)}</dd>
              </>
            ) : null}
            {node.type === 'computer' ? (
              <>
                <dt>OS</dt>
                <dd>{node.operatingSystem || '—'}</dd>
              </>
            ) : null}
          </dl>
        ) : null}

        {tab === 'account' ? (
          <dl className="kv">
            <dt>UPN</dt>
            <dd>
              {node.userPrincipalName || '—'}
              {node.userPrincipalName ? <CopyButton text={node.userPrincipalName} label="UPN" /> : null}
            </dd>
            <dt>SAM</dt>
            <dd>
              {node.sAMAccountName}
              <CopyButton text={node.sAMAccountName} label="SAM account name" />
            </dd>
            <dt>Logon</dt>
            <dd>{formatLogon(node.lastLogonTimestamp)}</dd>
            <dt>Flags</dt>
            <dd>{uacSummary(node).join(', ') || 'Normal'}</dd>
          </dl>
        ) : null}

        {tab === 'memberof' ? (
          <ul className="member-list">
            {memberOfIds.map((id) => {
              const g = resolve(id)
              if (!g) return null
              return (
                <li key={id}>
                  <button type="button" onClick={() => select(id)}>
                    <TypeGlyph type={g.type} />
                    {g.displayName}
                    <StatusBadges node={g} />
                  </button>
                </li>
              )
            })}
            {memberOfIds.length === 0 ? <li className="empty">No group memberships.</li> : null}
          </ul>
        ) : null}

        {tab === 'members' ? (
          <ul className="member-list">
            {memberIds.map((id) => {
              const m = resolve(id)
              if (!m) return null
              return (
                <li key={id}>
                  <button type="button" onClick={() => select(id)}>
                    <TypeGlyph type={m.type} />
                    {m.displayName}
                    <StatusBadges node={m} />
                  </button>
                </li>
              )
            })}
            {memberIds.length === 0 ? (
              <li className="empty">
                {isSecurityGroup(node.groupType) ? 'No members — empty security group.' : 'No members.'}
              </li>
            ) : null}
          </ul>
        ) : null}

        {tab === 'object' ? (
          <dl className="kv">
            <dt>DN</dt>
            <dd>
              <code>{node.dn}</code>
              <CopyButton text={node.dn} label="distinguished name" />
            </dd>
            <dt>GUID</dt>
            <dd>
              <code>{node.id}</code>
              <CopyButton text={node.id} label="object GUID" />
            </dd>
            <dt>Created</dt>
            <dd>{formatWhen(node.whenCreated)}</dd>
            <dt>Changed</dt>
            <dd>{formatWhen(node.whenChanged)}</dd>
          </dl>
        ) : null}

        {tab === 'spydir' ? (
          <div className="fix">
            <p>
              Direct member of {memberOfIds.length} group{memberOfIds.length === 1 ? '' : 's'}. {findings.length} finding
              {findings.length === 1 ? '' : 's'} on this object.
            </p>
            <p>
              <button type="button" className="linkish" onClick={() => goTo('web', node.id)}>
                Show in Web
              </button>
              {' · '}
              <button
                type="button"
                className="linkish"
                onClick={() => {
                  if (node.type === 'user' || node.type === 'group') setPathSource(node.id)
                  goTo('pathfinder', node.id)
                }}
              >
                Find paths
              </button>
            </p>
            {findings.map((f) => (
              <FindingCard key={f.id} finding={f}>
                <button type="button" className="linkish" onClick={() => goTo('hygiene', f.objectIds[0])}>
                  Open in Hygiene
                </button>
              </FindingCard>
            ))}
            {findings.length === 0 ? <p className="muted">No findings attached to this object.</p> : null}
          </div>
        ) : null}
      </div>
    </aside>
  )
}
