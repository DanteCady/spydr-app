import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { RULES, runEngine } from '../shared/engine/run'
import type { DirectoryEdge, DirectoryNode, Finding } from '../shared/types'

// ── helpers to build tiny directories ────────────────────────────────
const BASE = 'DC=t,DC=lab'
let seq = 0
function user(name: string, extra: Partial<DirectoryNode> = {}): DirectoryNode {
  const id = `u-${name}-${seq++}`
  return {
    id, type: 'user', dn: `CN=${name},CN=Users,${BASE}`, parentDn: `CN=Users,${BASE}`,
    name, displayName: name, sAMAccountName: name.toLowerCase(), description: '',
    userAccountControl: 0x200, lastLogonTimestamp: Date.now(), ...extra
  }
}
function group(name: string, extra: Partial<DirectoryNode> = {}): DirectoryNode {
  const id = `g-${name}-${seq++}`
  return {
    id, type: 'group', dn: `CN=${name},CN=Users,${BASE}`, parentDn: `CN=Users,${BASE}`,
    name, displayName: name, sAMAccountName: name.toLowerCase(), description: '',
    groupType: 0x80000002, ...extra
  }
}
const member = (from: DirectoryNode, to: DirectoryNode): DirectoryEdge => ({ from: from.id, to: to.id, via: 'member' })
const types = (f: Finding[]) => f.map((x) => x.type)

// ── golden: the refactor must reproduce the pre-engine detector output ─
describe('engine reproduces the golden fixture findings', () => {
  it('matches tests/golden/contoso-findings.json exactly', () => {
    const golden = JSON.parse(readFileSync(new URL('./golden/contoso-findings.json', import.meta.url), 'utf8')) as Finding[]
    const snap = loadContosoFixture()
    expect(snap.findings).toEqual(golden)
  })

  it('reports every rule at least once on the sample forest', () => {
    const seen = new Set(types(loadContosoFixture().findings))
    for (const r of RULES) expect(seen.has(r.id), r.id).toBe(true)
  })

  it('exposes facts and a bounded score', () => {
    const snap = loadContosoFixture()
    const res = runEngine(snap.nodes, snap.edges)
    expect(res.facts.rulesRun).toBe(RULES.length)
    expect(res.facts.cycles).toBe(1)
    expect(res.facts.deepestNesting).toBeGreaterThanOrEqual(4)
    expect(res.score).toBeGreaterThanOrEqual(0)
    expect(res.score).toBeLessThanOrEqual(100)
    expect(snap.stats.hygieneScore).toBe(res.score)
  })
})

// ── per-rule behaviour on minimal directories ─────────────────────────
describe('rules', () => {
  it('clean directory scores 100 with no findings', () => {
    const g = group('Ops'); const u = user('Amy')
    const res = runEngine([g, u], [member(u, g)])
    expect(res.findings).toEqual([])
    expect(res.score).toBe(100)
  })

  it('circular-nesting: A→B→A is one critical cycle', () => {
    const a = group('A'); const b = group('B')
    const res = runEngine([a, b], [member(a, b), member(b, a)])
    expect(types(res.findings)).toContain('circular-nesting')
    expect(res.findings.find((f) => f.type === 'circular-nesting')?.severity).toBe('critical')
    expect(res.facts.cycles).toBe(1)
  })

  it('deep-nesting: flags only chains deeper than the configured limit', () => {
    const chain = ['L0', 'L1', 'L2', 'L3', 'L4'].map((n) => group(n))
    const edges = chain.slice(1).map((g, i) => member(g, chain[i])) // L1∈L0, L2∈L1, …
    expect(types(runEngine(chain, edges).findings)).toContain('deep-nesting')
    expect(types(runEngine(chain, edges, { deepNesting: 10 }).findings)).not.toContain('deep-nesting')
  })

  it('empty-security-group: only security groups, only when truly empty', () => {
    const sec = group('Sec'); const dist = group('Dist', { groupType: 0x2 }); const full = group('Full'); const u = user('Bo')
    const res = runEngine([sec, dist, full, u], [member(u, full)])
    const empties = res.findings.filter((f) => f.type === 'empty-security-group').map((f) => f.objectIds[0])
    expect(empties).toEqual([sec.id])
  })

  it('disabled-in-group: disabled users with explicit memberships', () => {
    const g = group('App'); const off = user('Off', { userAccountControl: 0x202 }); const on = user('On')
    const res = runEngine([g, off, on], [member(off, g), member(on, g)])
    const hits = res.findings.filter((f) => f.type === 'disabled-in-group')
    expect(hits).toHaveLength(1)
    expect(hits[0].objectIds).toContain(off.id)
  })

  it('stale-in-group: respects staleDays and ignores disabled accounts', () => {
    const g = group('App')
    const old = user('Old', { lastLogonTimestamp: Date.now() - 120 * 86400000 })
    const never = user('Never', { lastLogonTimestamp: null })
    const oldButDisabled = user('OldOff', { lastLogonTimestamp: 0, userAccountControl: 0x202 })
    const edges = [member(old, g), member(never, g), member(oldButDisabled, g)]
    const stale = (cfg?: { staleDays: number }) =>
      runEngine([g, old, never, oldButDisabled], edges, cfg).findings.filter((f) => f.type === 'stale-in-group').map((f) => f.objectIds[0])
    expect(stale()).toEqual(expect.arrayContaining([old.id, never.id]))
    expect(stale()).not.toContain(oldButDisabled.id)
    expect(stale({ staleDays: 365 })).toEqual([never.id])
  })

  it('redundant-membership: direct member of parent and of nested child', () => {
    const parent = group('Parent'); const child = group('Child'); const u = user('Cy')
    const res = runEngine([parent, child, u], [member(child, parent), member(u, parent), member(u, child)])
    expect(types(res.findings)).toContain('redundant-membership')
  })

  it('privileged-nested-path: only nested routes, never direct membership', () => {
    const da = group('Domain Admins', { privileged: true }); const mid = group('Mid')
    const nestedUser = user('Nested'); const directUser = user('Direct')
    const res = runEngine([da, mid, nestedUser, directUser], [member(mid, da), member(nestedUser, mid), member(directUser, da)])
    const hits = res.findings.filter((f) => f.type === 'privileged-nested-path')
    expect(hits).toHaveLength(1)
    expect(hits[0].objectIds).toContain(nestedUser.id)
    expect(hits[0].objectIds).not.toContain(directUser.id)
  })

  it('distribution-in-security: dist group nested inside a security group', () => {
    const sec = group('Sec'); const dist = group('Mail', { groupType: 0x2 })
    const res = runEngine([sec, dist], [member(dist, sec)])
    expect(types(res.findings)).toContain('distribution-in-security')
    expect(types(runEngine([sec, dist], [member(sec, dist)]).findings)).not.toContain('distribution-in-security')
  })

  it('config.disabled skips a rule', () => {
    const a = group('A'); const b = group('B')
    const res = runEngine([a, b], [member(a, b), member(b, a)], { disabled: ['circular-nesting'] })
    expect(types(res.findings)).not.toContain('circular-nesting')
    expect(res.facts.rulesRun).toBe(RULES.length - 1)
  })
})
