import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { buildMembershipGraph, effectiveMembers, enumeratePaths, sharedLinks } from '../shared/graph'

const snapshot = loadContosoFixture()
const graph = buildMembershipGraph(snapshot.nodes, snapshot.edges)
const idOf = (sam: string): string => {
  const node = snapshot.nodes.find((n) => n.sAMAccountName === sam)
  if (!node) throw new Error(`no ${sam} in the fixture`)
  return node.id
}

describe('effectiveMembers', () => {
  it('finds the accounts that only reach a group through nesting', () => {
    const members = effectiveMembers(graph, idOf('Domain Admins'))
    const byId = new Map(members.map((m) => [m.id, m.depth]))
    const alice = idOf('achen')
    expect(byId.has(alice)).toBe(true)
    // Alice is not in the member list of Domain Admins; she arrives through two groups.
    expect(byId.get(alice)).toBeGreaterThan(1)
    expect(snapshot.edges.some((e) => e.from === alice && e.to === idOf('Domain Admins'))).toBe(false)
  })

  it('reports direct members at depth 1', () => {
    const members = effectiveMembers(graph, idOf('IT-Admins'))
    const direct = members.filter((m) => m.depth === 1).map((m) => m.id)
    for (const id of direct) {
      expect(snapshot.edges.some((e) => e.from === id && e.to === idOf('IT-Admins'))).toBe(true)
    }
  })

  it('returns nothing for an unknown group, rather than throwing', () => {
    expect(effectiveMembers(graph, 'no-such-id')).toEqual([])
  })

  it('never reports the group itself', () => {
    const group = idOf('Domain Admins')
    expect(effectiveMembers(graph, group).some((m) => m.id === group)).toBe(false)
  })
})

describe('sharedLinks', () => {
  it('names the one nesting both of Alice’s routes depend on', () => {
    const paths = enumeratePaths(graph, idOf('achen'), idOf('Domain Admins'))
    expect(paths.length).toBeGreaterThan(1)
    const links = sharedLinks(paths)
    expect(links.length).toBeGreaterThan(0)
    // Every shared link must genuinely appear in every path.
    for (const link of links) {
      for (const path of paths) {
        const i = path.nodeIds.indexOf(link.from)
        expect(i).toBeGreaterThanOrEqual(0)
        expect(path.nodeIds[i + 1]).toBe(link.to)
      }
    }
  })

  it('has nothing to say about no paths, and everything about one', () => {
    expect(sharedLinks([])).toEqual([])
    const single = enumeratePaths(graph, idOf('jbrooks'), idOf('Domain Admins'))
    expect(sharedLinks(single).length).toBe(single[0].nodeIds.length - 1)
  })
})
