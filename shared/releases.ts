/**
 * Release notes, parsed from Markdown.
 *
 * The notes are written by hand, one file per version in `content/releases/`, and read by two
 * things that must not disagree: the guide inside the app and the releases page on the site. The
 * parsing lives here so there is one answer to "what does this file say" rather than two that
 * drift. It is pure — the file reading differs on each side, the meaning does not.
 *
 * Writing them is deliberately a separate act from shipping. A changelog generated from commits
 * describes what the work was; release notes describe what changed for the person using it, which
 * is a different sentence almost every time.
 */

import { compareVersions } from './version'

export type HighlightType = 'new' | 'improved' | 'fixed'

/** Product areas, which are the app's own workspaces plus a general bucket. */
export type ReleaseCategory =
  | 'Directory'
  | 'Hygiene'
  | 'Pathfinder'
  | 'Web'
  | 'Timeline'
  | 'Reports'
  | 'Settings'
  | 'Platform'

export const CATEGORIES: ReleaseCategory[] = [
  'Directory',
  'Hygiene',
  'Pathfinder',
  'Web',
  'Timeline',
  'Reports',
  'Settings',
  'Platform'
]

export interface Highlight {
  type: HighlightType
  category: ReleaseCategory
  text: string
}

export interface Release {
  version: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  title: string
  summary: string
  highlights: Highlight[]
}

const TYPES: Record<string, HighlightType> = { new: 'new', improved: 'improved', fixed: 'fixed' }
const KNOWN = new Set<string>(CATEGORIES)

/** Frontmatter, as much of YAML as these files are allowed to use. */
function frontmatter(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[m[1]] = value
  }
  return out
}

function required(meta: Record<string, string>, key: string, where: string): string {
  const value = meta[key]?.trim()
  if (!value) throw new Error(`${where}: release notes need a "${key}"`)
  return value
}

function highlights(body: string, where: string): Highlight[] {
  const found: Highlight[] = []
  let category: ReleaseCategory | null = null

  for (const line of body.split(/\r?\n/)) {
    const heading = line.match(/^###\s+(.+?)\s*$/)
    if (heading) {
      const name = heading[1].trim()
      // Refusing an unknown category is the point: a typo would otherwise silently create a
      // section that no filter or index on either side knows about.
      if (!KNOWN.has(name)) {
        throw new Error(`${where}: "${name}" is not a release category. Use one of: ${CATEGORIES.join(', ')}`)
      }
      category = name as ReleaseCategory
      continue
    }

    const bullet = line.match(/^-\s+\*\*(New|Improved|Fixed):\*\*\s+(.+?)\s*$/i)
    if (!bullet) continue
    if (!category) throw new Error(`${where}: "${bullet[2]}" appears before any ### category heading`)
    found.push({ type: TYPES[bullet[1].toLowerCase()], category, text: bullet[2].trim() })
  }

  return found
}

export function parseRelease(raw: string, where = 'release notes'): Release {
  const trimmed = raw.replace(/^﻿/, '').trim()
  // The body may be empty — a freshly bumped file has frontmatter and nothing under it yet, and
  // "you have not written the notes" is a far more useful complaint than "missing frontmatter".
  const match = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---[^\S\r\n]*(?:\r?\n([\s\S]*))?$/)
  if (!match) throw new Error(`${where}: missing the --- frontmatter block`)

  const meta = frontmatter(match[1])
  const date = required(meta, 'date', where)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${where}: date must be YYYY-MM-DD, not "${date}"`)

  return {
    version: required(meta, 'version', where),
    date,
    title: required(meta, 'title', where),
    summary: required(meta, 'summary', where),
    highlights: highlights(match[2] ?? '', where)
  }
}

/** Newest first, which is the only order either reader wants. */
export function sortReleases(releases: Release[]): Release[] {
  return [...releases].sort((a, b) => b.date.localeCompare(a.date) || compareVersions(b.version, a.version))
}

export function groupByCategory(items: Highlight[]): { category: ReleaseCategory; items: Highlight[] }[] {
  const order: ReleaseCategory[] = []
  const map = new Map<ReleaseCategory, Highlight[]>()
  for (const h of items) {
    if (!map.has(h.category)) {
      map.set(h.category, [])
      order.push(h.category)
    }
    map.get(h.category)?.push(h)
  }
  return order.map((category) => ({ category, items: map.get(category) ?? [] }))
}

export function highlightLabel(type: HighlightType): string {
  return type === 'new' ? 'New' : type === 'improved' ? 'Improved' : 'Fixed'
}

/**
 * Whether there is a release the user has not been shown yet.
 *
 * An install that has never recorded one is not treated as unread: someone opening SPYDR for the
 * first time should not be met with a notification about a version they have nothing to compare
 * against. The first run records where they came in, and only later releases count.
 */
export function hasUnread(latest: string | undefined, lastSeen: string | undefined): boolean {
  if (!latest || !lastSeen) return false
  return compareVersions(latest, lastSeen) > 0
}

export function formatReleaseDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  })
}
