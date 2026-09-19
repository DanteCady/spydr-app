import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { describeDiff, diffSnapshots } from '../shared/diff'
import type { DirectorySnapshot } from '../shared/types'

const base = loadContosoFixture()
const clone = (): DirectorySnapshot => JSON.parse(JSON.stringify(base)) as DirectorySnapshot

describe('diffSnapshots', () => {
  it('reports nothing for an unchanged re-read', () => {
    const diff = diffSnapshots(base, clone())
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
    expect(diff.changed).toEqual([])
    expect(diff.edgesAdded + diff.edgesRemoved).toBe(0)
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

  it('spots a rename and a disable without counting them as new objects', () => {
    const after = clone()
    after.nodes[2] = { ...after.nodes[2], displayName: 'Renamed Person' }
    after.nodes[3] = { ...after.nodes[3], userAccountControl: 514 }

    const diff = diffSnapshots(base, after)
    expect(diff.added).toEqual([])
    expect(diff.changed.map((c) => c.after.id).sort()).toEqual([base.nodes[2].id, base.nodes[3].id].sort())
  })

  it('counts memberships in both directions', () => {
    const after = clone()
    const dropped = after.edges[0]
    after.edges = after.edges.slice(1)
    after.edges.push({ from: dropped.to, to: dropped.from, via: 'member' })

    const diff = diffSnapshots(base, after)
    expect(diff.edgesRemoved).toBe(1)
    expect(diff.edgesAdded).toBe(1)
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
