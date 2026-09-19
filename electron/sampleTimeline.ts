import { loadContosoFixture } from '../fixtures/contoso-lab'
import { diffSnapshots } from '../shared/diff'
import { rescoreSnapshot } from '../shared/enrich'
import { DEFAULT_SETTINGS } from '../shared/settings'
import { readScope } from '../shared/timeline'
import type { DirectoryNode, DirectorySnapshot } from '../shared/types'
import { clearSampleEntries, recordRead } from './timeline'

/**
 * Six weeks of invented history for the fictional domain, so the Timeline has something to show
 * before anyone has read a real directory twice.
 *
 * Every entry is produced by mutating the sample and running the same diff and the same rules that
 * a real read would — the counts, the findings and the score are all genuinely computed. Nothing
 * here is a hand-written payload pretending to be one, which also means the demo cannot drift away
 * from what the feature actually does.
 */

const DAY = 86_400_000

function clone(snapshot: DirectorySnapshot): DirectorySnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as DirectorySnapshot
}

function find(snapshot: DirectorySnapshot, sam: string): DirectoryNode | undefined {
  return snapshot.nodes.find((n) => n.sAMAccountName.toLowerCase() === sam.toLowerCase())
}

function user(id: string, name: string, sam: string, parentDn: string): DirectoryNode {
  return {
    id,
    type: 'user',
    dn: `CN=${name},${parentDn}`,
    parentDn,
    name,
    displayName: name,
    sAMAccountName: sam,
    description: '',
    userPrincipalName: `${sam}@contoso.lab`,
    userAccountControl: 512,
    lastLogonTimestamp: Date.now(),
    whenCreated: new Date().toISOString()
  }
}

/** Each step returns the directory as it stood after some change someone made. */
const STEPS: { days: number; dcHost?: string; change: (s: DirectorySnapshot) => void }[] = [
  {
    // A new starter, placed in IT and given the team's group.
    days: 33,
    change: (s) => {
      const it = s.nodes.find((n) => n.dn.startsWith('OU=IT'))
      const helpdesk = find(s, 'Helpdesk')
      const ravi = user('sample-ravi', 'Ravi Patel', 'rpatel', it?.dn ?? s.baseDn)
      s.nodes.push(ravi)
      if (helpdesk) s.edges.push({ from: ravi.id, to: helpdesk.id, via: 'member' })
    }
  },
  {
    // The change that matters: somebody nests the all-staff mailing list into an admin group, and
    // every person on that list inherits a path into Domain Admins.
    days: 26,
    change: (s) => {
      const allStaff = find(s, 'All-Staff')
      const itAdmins = find(s, 'IT-Admins')
      if (allStaff && itAdmins && !s.edges.some((e) => e.from === allStaff.id && e.to === itAdmins.id)) {
        s.edges.push({ from: allStaff.id, to: itAdmins.id, via: 'member' })
      }
    }
  },
  {
    // Read from the second controller, which is how replication artefacts appear.
    days: 19,
    dcHost: 'dc02.contoso.lab',
    change: (s) => {
      const carol = find(s, 'csingh')
      if (carol) carol.description = 'On extended leave'
    }
  },
  {
    // A leaver: disabled, and taken out of a group.
    days: 12,
    change: (s) => {
      const irene = find(s, 'ikim')
      if (!irene) return
      irene.userAccountControl = (irene.userAccountControl ?? 512) | 2
      const allStaff = find(s, 'All-Staff')
      if (allStaff) s.edges = s.edges.filter((e) => !(e.from === irene.id && e.to === allStaff.id))
    }
  },
  {
    // Cleanup: the mailing list comes back out of the admin group, and an abandoned group is deleted.
    days: 4,
    change: (s) => {
      const allStaff = find(s, 'All-Staff')
      const itAdmins = find(s, 'IT-Admins')
      s.edges = s.edges.filter((e) => !(allStaff && itAdmins && e.from === allStaff.id && e.to === itAdmins.id))
      const empty = find(s, 'Empty-Security')
      if (empty) {
        s.nodes = s.nodes.filter((n) => n.id !== empty.id)
        s.edges = s.edges.filter((e) => e.from !== empty.id && e.to !== empty.id)
      }
    }
  }
]

export interface SampleResult {
  created: number
  replaced: number
}

export function generateSampleTimeline(now = new Date()): SampleResult {
  const replaced = clearSampleEntries()
  const hygiene = DEFAULT_SETTINGS.hygiene
  let previous = rescoreSnapshot(loadContosoFixture(), hygiene)
  const scope = readScope(previous, DEFAULT_SETTINGS)
  const usualHost = previous.dcHost
  let created = 0

  const baselineAt = new Date(now.getTime() - 40 * DAY)
  previous = { ...previous, ingestedAt: baselineAt.toISOString() }
  if (recordRead({ snapshot: previous, diff: null, scope, source: 'sample', at: baselineAt })) created += 1

  for (const step of STEPS) {
    const draft = clone(previous)
    step.change(draft)
    const at = new Date(now.getTime() - step.days * DAY)
    const next = {
      ...rescoreSnapshot(draft, hygiene),
      ingestedAt: at.toISOString(),
      dcHost: step.dcHost ?? usualHost
    }
    const diff = diffSnapshots(previous, next)
    if (recordRead({ snapshot: next, diff, scope, source: 'sample', at })) created += 1
    previous = next
  }

  return { created, replaced }
}
