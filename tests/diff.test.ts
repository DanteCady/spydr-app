import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { describeDiff, diffSnapshots, isUnchanged } from '../shared/diff'
import type { DirectorySnapshot } from '../shared/types'

const base = loadContosoFixture()
const clone = (): DirectorySnapshot => JSON.parse(JSON.stringify(base)) as DirectorySnapshot

describe('diffSnapshots', () => {
  it('reports nothing for an unchanged re-read', () => {
    const diff = diffSnapshots(base, clone())
    expect(isUnchanged(diff)).toBe(true)
    expect(describeDiff(diff)).toBe('Nothing changed since the last read.')
  })

  it('names an object that appeared and one that went away', () => {
    const after = clone()
    const gone = after.nodes[5]
    after.nodes = after.nodes.filter((n) => n.id !== gone.id)
    after.nodes.push({ ...gone, id: 'brand-new', dn: 'CN=New User,DC=contoso,DC=lab', displayName: 'New User' })

    const diff = diffSnapshots(base, after)
    expect(diff.added.map((n) => n.id)).toEqual(['brand-new'])
    expect(diff.removed.map((n) => n.id)).toEqual([gone.id])
    expect(describeDiff(diff)).toContain('1 object added, 1 object removed')
  })

  it('describes a rename and a disable in words, without calling them new objects', () => {
    const after = clone()
    after.nodes[2] = { ...after.nodes[2], displayName: 'Renamed Person' }
    after.nodes[3] = { ...after.nodes[3], userAccountControl: (after.nodes[3].userAccountControl ?? 512) | 2 }

    const diff = diffSnapshots(base, after)
    expect(diff.added).toEqual([])
    const renamed = diff.changed.find((c) => c.id === base.nodes[2].id)
    const disabled = diff.changed.find((c) => c.id === base.nodes[3].id)
    expect(renamed?.changes[0]).toContain(`renamed from ${base.nodes[2].displayName}`)
    expect(disabled?.changes).toContain('disabled')
  })

  it('names both ends of a membership that changed', () => {
    const after = clone()
    const dropped = after.edges[0]
    after.edges = after.edges.slice(1)

    const diff = diffSnapshots(base, after)
    expect(diff.membershipsRemoved).toHaveLength(1)
    const [change] = diff.membershipsRemoved
    expect(change.fromId).toBe(dropped.from)
    expect(change.toId).toBe(dropped.to)
    // Names, not GUIDs — the timeline has to read without the directory open.
    expect(change.fromName).not.toBe(change.fromId)
    expect(change.toName).not.toBe(change.toId)
  })

  it('separates findings that opened from findings that closed', () => {
    const after = clone()
    const closed = after.findings[0]
    after.findings = after.findings.slice(1)
    after.findings.push({ ...closed, id: 'new-finding', title: 'Something new' })

    const diff = diffSnapshots(base, after)
    expect(diff.findingsClosed.map((f) => f.id)).toEqual([closed.id])
    expect(diff.findingsOpened.map((f) => f.id)).toEqual(['new-finding'])
  })

  it('mentions the score only when it moved', () => {
    const after = clone()
    after.findings = after.findings.slice(1)
    after.stats = { ...after.stats, hygieneScore: after.stats.hygieneScore + 4 }
    const line = describeDiff(diffSnapshots(base, after))
    expect(line).toContain('findings')
    expect(line).toContain('score')
  })
})
