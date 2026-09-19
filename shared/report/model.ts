import { RULES } from '../engine/registry'
import { DEFAULT_CONFIG } from '../engine/rule'
import type { DirectoryNode, DirectorySnapshot, Finding, FindingSeverity, FindingType } from '../types'

/**
 * The report as data. Pure, so it can be unit-tested and rendered by anything — the PDF writer is
 * only one consumer. Nothing here knows about HTML, fonts, or page sizes.
 */

export interface ReportMeta {
  domain: string
  baseDn: string
  host: string
  protocol: string
  boundAs: string
  source: 'ldap' | 'fixture'
  ingestedAt: string
  generatedAt: string
}

export interface ReportFinding {
  severity: FindingSeverity
  title: string
  detail: string
  fix: string
  objects: string[]
}

export type ReportBlock =
  | { kind: 'para'; text: string }
  | { kind: 'stats'; items: { value: string; label: string; note: string }[] }
  | { kind: 'callout'; lead: string; body: string }
  | { kind: 'bars'; items: { label: string; count: number; share: number; severity: FindingSeverity }[] }
  | { kind: 'table'; head: [string, string]; rows: [string, string][] }
  | { kind: 'findings'; title: string; items: ReportFinding[]; omitted: number }

export interface ReportSection {
  /** Small uppercase label in the running header. */
  label: string
  heading: string
  blocks: ReportBlock[]
}

export interface Report {
  meta: ReportMeta
  eyebrow: string
  title: string
  lede: string
  sections: ReportSection[]
}

export interface ReportOptions {
  /** Findings listed per rule section before the rest are summarised as a count. */
  perSection?: number
  /** Findings listed in the priority section. */
  priority?: number
  generatedAt?: Date
}

const SEVERITY_ORDER: FindingSeverity[] = ['critical', 'high', 'medium', 'low']

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
}

/** Plain-language read on the score, so the number is not the only thing on the page. */
export function verdict(score: number): { word: string; line: string } {
  if (score >= 90) return { word: 'Healthy', line: 'Membership is tidy; the findings below are housekeeping.' }
  if (score >= 70)
    return { word: 'Good', line: 'The shape of the directory is sound, with a handful of things worth correcting.' }
  if (score >= 45)
    return { word: 'Needs attention', line: 'Enough nesting and stale membership has built up to make access hard to reason about.' }
  return { word: 'At risk', line: 'Effective access cannot be read off the group structure as it stands.' }
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`
}

function names(snapshot: DirectorySnapshot, ids: string[], max: number): string[] {
  const byId = new Map(snapshot.nodes.map((n) => [n.id, n] as const))
  const out: string[] = []
  for (const id of ids) {
    const node: DirectoryNode | undefined = byId.get(id)
    if (node) out.push(node.sAMAccountName || node.displayName)
    if (out.length === max) break
  }
  if (ids.length > out.length) out.push(`+${ids.length - out.length} more`)
  return out
}

/**
 * `dedupe` is the heading the row will sit under. Several rules title every finding after the rule
 * itself, which reads as an echo once the heading is right above it — those rows lead with the
 * object instead.
 */
function toRow(snapshot: DirectorySnapshot, f: Finding, dedupe?: string): ReportFinding {
  const primary = snapshot.nodes.find((n) => n.id === f.objectIds[0])
  return {
    severity: f.severity,
    title: f.title === dedupe && primary ? primary.displayName : f.title,
    detail: truncate(f.detail, 300),
    fix: truncate(f.suggestedFix, 260),
    objects: names(snapshot, f.objectIds, 5)
  }
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`
}

function summaryParagraph(snapshot: DirectorySnapshot, counts: Record<FindingSeverity, number>): string {
  const { stats } = snapshot
  const objects = stats.users + stats.groups + stats.computers + stats.ous
  const worst = SEVERITY_ORDER.find((s) => counts[s] > 0)
  const tail = worst
    ? `The most severe are ${plural(counts[worst], `${SEVERITY_LABEL[worst].toLowerCase()} finding`)}, listed first below.`
    : 'No rule fired against this directory.'
  return (
    `SPYDR read ${objects.toLocaleString()} objects and ${stats.edges.toLocaleString()} membership edges under ` +
    `${snapshot.baseDn}, then ran ${plural(RULES.length, 'hygiene rule')} over the resulting graph. ` +
    `${plural(stats.findings, 'finding')} came back. ${tail}`
  )
}

/** A filename the user will recognise in their Downloads folder. */
export function reportFileName(snapshot: DirectorySnapshot, now = new Date()): string {
  const domain = (snapshot.domain || 'directory').replace(/[^a-z0-9.-]+/gi, '-').replace(/^-+|-+$/g, '')
  return `SPYDR-${domain}-hygiene-${now.toISOString().slice(0, 10)}.pdf`
}

export function buildReport(snapshot: DirectorySnapshot, options: ReportOptions = {}): Report {
  const perSection = options.perSection ?? 24
  const priorityMax = options.priority ?? 10
  const generatedAt = options.generatedAt ?? new Date()

  const findings = snapshot.findings
  const counts = Object.fromEntries(
    SEVERITY_ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length])
  ) as Record<FindingSeverity, number>
  const score = snapshot.stats.hygieneScore
  const v = verdict(score)
  const objects = snapshot.stats.users + snapshot.stats.groups + snapshot.stats.computers + snapshot.stats.ous
  const worstCount = Math.max(1, ...SEVERITY_ORDER.map((s) => counts[s]))

  const overview: ReportSection = {
    label: 'Overview',
    heading: 'What SPYDR found',
    blocks: [
      { kind: 'para', text: summaryParagraph(snapshot, counts) },
      {
        kind: 'stats',
        items: [
          { value: `${score}`, label: `Hygiene score out of 100 — ${v.word.toLowerCase()}`, note: 'Weighted by severity' },
          { value: `${findings.length}`, label: 'Findings across all rules', note: `${RULES.length} rules run` },
          {
            value: `${counts.critical + counts.high}`,
            label: 'Critical and high severity findings',
            note: 'Review these first'
          },
          { value: objects.toLocaleString(), label: 'Directory objects read', note: `${snapshot.stats.edges.toLocaleString()} edges` }
        ]
      },
      {
        kind: 'bars',
        items: SEVERITY_ORDER.map((s) => ({
          label: SEVERITY_LABEL[s],
          count: counts[s],
          share: counts[s] / worstCount,
          severity: s
        }))
      },
      {
        kind: 'callout',
        lead: `Read: ${v.word.toLowerCase()}.`,
        body: `${v.line} The score saturates rather than subtracting, so every finding you close moves it up — it never bottoms out at zero on a large domain.`
      }
    ]
  }

  const priority = findings
    .filter((f) => f.severity === 'critical' || f.severity === 'high')
    .slice(0, priorityMax)
  const priorityTotal = findings.filter((f) => f.severity === 'critical' || f.severity === 'high').length

  const priorityBlocks: ReportBlock[] = priority.length
    ? [
        {
          kind: 'para',
          text:
            'These are the findings that change who can do what. Each one names the objects involved and the ' +
            'change SPYDR would suggest — SPYDR is read-only, so nothing here has been applied.'
        },
        {
          kind: 'findings',
          title: `Highest severity — ${priorityTotal} total`,
          items: priority.map((f) => toRow(snapshot, f)),
          omitted: Math.max(0, priorityTotal - priority.length)
        }
      ]
    : [
        {
          kind: 'para',
          text:
            'No critical or high severity findings. Nothing in this directory grants privileged access through a ' +
            'path that SPYDR considers hard to see. The remaining sections cover lower severity cleanup.'
        }
      ]

  const priorities: ReportSection = {
    label: 'Priorities',
    heading: 'What to fix first',
    blocks: priorityBlocks
  }

  const byType = new Map<FindingType, Finding[]>()
  for (const f of findings) {
    const list = byType.get(f.type)
    if (list) list.push(f)
    else byType.set(f.type, [f])
  }

  const ruleSections: ReportSection[] = RULES.filter((r) => byType.has(r.id)).map((rule) => {
    const list = byType.get(rule.id) ?? []
    const shown = list.slice(0, perSection)
    return {
      label: 'Findings',
      heading: rule.name,
      blocks: [
        { kind: 'para', text: `${rule.describe} ${plural(list.length, 'finding')} of ${SEVERITY_LABEL[rule.severity].toLowerCase()} severity.` },
        // No card title: the section heading right above it already names the rule.
        {
          kind: 'findings',
          title: '',
          items: shown.map((f) => toRow(snapshot, f, rule.name)),
          omitted: list.length - shown.length
        }
      ]
    }
  })

  const method: ReportSection = {
    label: 'Appendix',
    heading: 'Scope and method',
    blocks: [
      {
        kind: 'para',
        text:
          'Every number in this report comes from a single read of the directory, taken at the time below. ' +
          'SPYDR binds, pages through the naming context, resolves ranged group membership, and evaluates the ' +
          'rules locally. It issues no add, modify, or delete.'
      },
      {
        kind: 'table',
        head: ['Scan', 'Value'],
        rows: [
          ['Domain', snapshot.domain],
          ['Base DN', snapshot.baseDn],
          ['Domain controller', snapshot.dcHost || '—'],
          ['Protocol', (snapshot.protocol ?? (snapshot.source === 'fixture' ? 'sample data' : 'ldap')).toUpperCase()],
          ['Bound as', snapshot.boundAs || '—'],
          ['Read at', new Date(snapshot.ingestedAt).toLocaleString()],
          ['Users / groups', `${snapshot.stats.users.toLocaleString()} / ${snapshot.stats.groups.toLocaleString()}`],
          ['OUs / computers', `${snapshot.stats.ous.toLocaleString()} / ${snapshot.stats.computers.toLocaleString()}`],
          ['Membership edges', snapshot.stats.edges.toLocaleString()]
        ]
      },
      {
        kind: 'table',
        head: ['Rule', 'Looks for'],
        rows: RULES.map((r) => [`${r.name} (${SEVERITY_LABEL[r.severity]})`, r.describe] as [string, string])
      },
      {
        kind: 'callout',
        lead: 'Thresholds.',
        body:
          `A user counts as stale after ${DEFAULT_CONFIG.staleDays} days without a logon. A group is deeply nested ` +
          `past ${DEFAULT_CONFIG.deepNesting} levels. Up to ${DEFAULT_CONFIG.maxPrivilegedPaths} nested paths are ` +
          'enumerated per user and privileged group.'
      }
    ]
  }

  return {
    meta: {
      domain: snapshot.domain,
      baseDn: snapshot.baseDn,
      host: snapshot.dcHost || '—',
      protocol: (snapshot.protocol ?? (snapshot.source === 'fixture' ? 'sample' : 'ldap')).toUpperCase(),
      boundAs: snapshot.boundAs || '—',
      source: snapshot.source,
      ingestedAt: snapshot.ingestedAt,
      generatedAt: generatedAt.toISOString()
    },
    eyebrow: snapshot.source === 'fixture' ? 'SPYDR SAMPLE REPORT' : 'SPYDR DIRECTORY HYGIENE REPORT',
    title: snapshot.domain,
    lede:
      `A read-only review of group membership, nesting, and account hygiene across ${objects.toLocaleString()} ` +
      `objects. Scored ${score} of 100 — ${v.word.toLowerCase()}.`,
    sections: [overview, priorities, ...ruleSections, method]
  }
}
