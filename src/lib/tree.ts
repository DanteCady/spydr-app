import type { DirectoryNode, DirectoryObjectType } from '@shared/types'

export interface OuTreeNode {
  id: string
  dn: string
  name: string
  type: DirectoryObjectType
  children: OuTreeNode[]
}

export function buildOuTree(nodes: DirectoryNode[], baseDn: string): OuTreeNode[] {
  const containers = nodes.filter((n) => n.type === 'ou' || n.type === 'container')
  const byDn = new Map(containers.map((n) => [n.dn.toLowerCase(), n]))
  const children = new Map<string, DirectoryNode[]>()

  for (const n of containers) {
    const parent = n.parentDn?.toLowerCase() ?? ''
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent)!.push(n)
  }

  const sort = (list: DirectoryNode[]): DirectoryNode[] =>
    [...list].sort((a, b) => a.name.localeCompare(b.name))

  const walk = (dn: string): OuTreeNode[] => {
    const kids = sort(children.get(dn.toLowerCase()) ?? [])
    return kids.map((n) => ({
      id: n.id,
      dn: n.dn,
      name: n.name,
      type: n.type,
      children: walk(n.dn)
    }))
  }

  const root = byDn.get(baseDn.toLowerCase())
  if (root) {
    return [
      {
        id: root.id,
        dn: root.dn,
        name: root.displayName || root.name,
        type: root.type,
        children: walk(root.dn)
      }
    ]
  }
  return walk(baseDn)
}

export function objectsInContainer(nodes: DirectoryNode[], containerDn: string, includeNested: boolean): DirectoryNode[] {
  const want = containerDn.toLowerCase()
  return nodes.filter((n) => {
    if (n.dn.toLowerCase() === want) return false
    if (includeNested) {
      return n.dn.toLowerCase().endsWith(`,${want}`) || n.parentDn?.toLowerCase() === want
    }
    return n.parentDn?.toLowerCase() === want
  })
}
