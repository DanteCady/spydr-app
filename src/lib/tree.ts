import type { DirectoryNode, DirectoryObjectType } from '@shared/types'

export interface OuTreeNode {
  id: string
  dn: string
  name: string
  type: DirectoryObjectType
  node: DirectoryNode
  children: OuTreeNode[]
}

/** Containers an admin expects to see. Everything else with objectClass=container is plumbing. */
const WELL_KNOWN_CONTAINERS = new Set([
  'users',
  'computers',
  'builtin',
  'foreignsecurityprincipals',
  'managed service accounts'
])

function rdnValue(dn: string): string {
  return (dn.split(',')[0] ?? '').replace(/^(CN|OU|DC)=/i, '')
}

/**
 * True for the containers Active Directory creates for its own bookkeeping — GUID-named policy
 * objects, everything under CN=System, and the rest of the plumbing (rpc, ethers, PSPs). ADUC
 * hides these unless Advanced Features is on; a real domain has well over a hundred of them.
 * Organizational units are always admin-created, so they are never system.
 */
export function isSystemContainer(node: DirectoryNode, baseDn: string): boolean {
  if (node.type !== 'container') return false
  if (node.dn.toLowerCase() === baseDn.toLowerCase()) return false
  const rdn = rdnValue(node.dn).toLowerCase()
  return !WELL_KNOWN_CONTAINERS.has(rdn)
}

export function buildOuTree(
  nodes: DirectoryNode[],
  baseDn: string,
  options: { includeSystem?: boolean } = {}
): OuTreeNode[] {
  const includeSystem = options.includeSystem ?? false
  const containers = nodes.filter(
    (n) =>
      (n.type === 'ou' || n.type === 'container') &&
      (includeSystem || !isSystemContainer(n, baseDn))
  )
  const byDn = new Map(containers.map((n) => [n.dn.toLowerCase(), n]))
  const children = new Map<string, DirectoryNode[]>()

  for (const n of containers) {
    const parent = n.parentDn?.toLowerCase() ?? ''
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent)!.push(n)
  }

  const sort = (list: DirectoryNode[]): DirectoryNode[] =>
    [...list].sort(
      (a, b) => (a.type === 'ou' ? 0 : 1) - (b.type === 'ou' ? 0 : 1) || a.name.localeCompare(b.name)
    )

  const toTreeNode = (n: DirectoryNode): OuTreeNode => ({
    id: n.id,
    dn: n.dn,
    name: n.displayName || n.name,
    type: n.type,
    node: n,
    children: walk(n.dn)
  })

  const walk = (dn: string): OuTreeNode[] => sort(children.get(dn.toLowerCase()) ?? []).map(toTreeNode)

  const root = byDn.get(baseDn.toLowerCase())
  return root ? [toTreeNode(root)] : walk(baseDn)
}

/** Every id in the tree that has children, for expand/collapse all. */
export function expandableIds(tree: OuTreeNode[]): string[] {
  const out: string[] = []
  const walk = (nodes: OuTreeNode[]): void => {
    for (const n of nodes) {
      if (n.children.length > 0) {
        out.push(n.id)
        walk(n.children)
      }
    }
  }
  walk(tree)
  return out
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
