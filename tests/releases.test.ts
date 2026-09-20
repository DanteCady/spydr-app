import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CATEGORIES,
  formatReleaseDate,
  groupByCategory,
  hasUnread,
  highlightLabel,
  parseRelease,
  sortReleases,
  type Release
} from '../shared/releases'

const CONTENT = join(__dirname, '../content/releases')

/**
 * Read the files without parsing them.
 *
 * Parsing at module scope would throw while vitest was still collecting, and a collection error
 * reports as "no tests" — which is the least useful thing to see right after running the bump
 * script and forgetting to write the notes. Parsing happens inside a test, so the failure arrives
 * as the sentence explaining what to do.
 */
function readAll(): { file: string; raw: string }[] {
  return readdirSync(CONTENT)
    .filter((f) => f.endsWith('.md'))
    .map((file) => ({ file, raw: readFileSync(join(CONTENT, file), 'utf8') }))
}

function loadAll(): { file: string; release: Release }[] {
  return readAll().map(({ file, raw }) => ({ file, release: parseRelease(raw, file) }))
}

describe('parseRelease', () => {
  const good = `---
version: "1.2.3"
date: "2026-01-02"
title: "A title"
summary: "A summary."
---

### Directory
- **New:** Something new.
- **Fixed:** Something fixed.

### Timeline
- **Improved:** Something better.
`

  it('reads frontmatter and typed bullets', () => {
    const r = parseRelease(good)
    expect(r.version).toBe('1.2.3')
    expect(r.date).toBe('2026-01-02')
    expect(r.highlights).toHaveLength(3)
    expect(r.highlights[0]).toEqual({ type: 'new', category: 'Directory', text: 'Something new.' })
    expect(r.highlights[2]).toEqual({ type: 'improved', category: 'Timeline', text: 'Something better.' })
  })

  it('refuses a file with no frontmatter', () => {
    expect(() => parseRelease('### Directory\n- **New:** x')).toThrow(/frontmatter/)
  })

  it('names the missing field rather than failing vaguely', () => {
    expect(() => parseRelease('---\nversion: "1.0.0"\n---\n')).toThrow(/"date"/)
  })

  it('refuses a date that is not YYYY-MM-DD', () => {
    const bad = good.replace('2026-01-02', '2 Jan 2026')
    expect(() => parseRelease(bad)).toThrow(/YYYY-MM-DD/)
  })

  /** A typo'd heading would otherwise create a section no index on either side knows about. */
  it('refuses an unknown category and lists the real ones', () => {
    const bad = good.replace('### Directory', '### Directries')
    expect(() => parseRelease(bad)).toThrow(/not a release category/)
  })

  it('refuses a highlight that appears before any category', () => {
    const bad = `---
version: "1.0.0"
date: "2026-01-02"
title: "t"
summary: "s"
---

- **New:** Orphaned.
`
    expect(() => parseRelease(bad)).toThrow(/before any/)
  })

  it('ignores prose between bullets', () => {
    const withProse = good.replace('### Directory\n', '### Directory\nSome intro sentence.\n')
    expect(parseRelease(withProse).highlights).toHaveLength(3)
  })
})

describe('ordering and grouping', () => {
  const make = (version: string, date: string): Release => ({
    version,
    date,
    title: '',
    summary: '',
    highlights: []
  })

  it('sorts newest first', () => {
    const sorted = sortReleases([make('0.1.0', '2026-01-01'), make('0.3.0', '2026-03-01'), make('0.2.0', '2026-02-01')])
    expect(sorted.map((r) => r.version)).toEqual(['0.3.0', '0.2.0', '0.1.0'])
  })

  /** Two releases on one day still need a stable order, and 0.10 is above 0.9, not below it. */
  it('breaks a date tie numerically, not alphabetically', () => {
    const sorted = sortReleases([make('0.9.0', '2026-01-01'), make('0.10.0', '2026-01-01')])
    expect(sorted.map((r) => r.version)).toEqual(['0.10.0', '0.9.0'])
  })

  it('groups highlights in the order the categories first appear', () => {
    const grouped = groupByCategory([
      { type: 'new', category: 'Timeline', text: 'a' },
      { type: 'fixed', category: 'Directory', text: 'b' },
      { type: 'new', category: 'Timeline', text: 'c' }
    ])
    expect(grouped.map((g) => g.category)).toEqual(['Timeline', 'Directory'])
    expect(grouped[0].items).toHaveLength(2)
  })

  it('labels every highlight type', () => {
    expect(highlightLabel('new')).toBe('New')
    expect(highlightLabel('improved')).toBe('Improved')
    expect(highlightLabel('fixed')).toBe('Fixed')
  })

  it('formats a date without drifting a day across time zones', () => {
    expect(formatReleaseDate('2026-09-19')).toBe('19 September 2026')
    expect(formatReleaseDate('2026-01-01')).toBe('1 January 2026')
  })
})

describe('hasUnread', () => {
  it('is true only when the latest release is newer than what was seen', () => {
    expect(hasUnread('0.2.0', '0.1.0')).toBe(true)
    expect(hasUnread('0.2.0', '0.2.0')).toBe(false)
    expect(hasUnread('0.1.0', '0.2.0')).toBe(false)
  })

  /** A first run should not be greeted by a notification about a version it never missed. */
  it('is false on an install that has never recorded one', () => {
    expect(hasUnread('0.2.0', undefined)).toBe(false)
    expect(hasUnread(undefined, undefined)).toBe(false)
  })
})

/**
 * The guard that makes the whole thing trustworthy: if these drift, the app, the site and the
 * installers start disagreeing about what version this is, and nothing else would notice.
 */
describe('the shipped release notes', () => {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8')) as { version: string }

  it('parse without error', () => {
    const files = readAll()
    expect(files.length).toBeGreaterThan(0)
    for (const { file, raw } of files) {
      // Named so an unwritten stub says which file, rather than failing somewhere anonymous.
      const release = parseRelease(raw, `content/releases/${file}`)
      expect(release.version, `${file} states a different version than its filename`).toBe(file.replace(/\.md$/, ''))
    }
  })

  it('include one for the version in package.json', () => {
    const all = loadAll()
    const versions = all.map((a) => a.release.version)
    expect(
      versions,
      `package.json is ${pkg.version} but there are no notes for it — run "npm run version:bump" rather than editing package.json by hand`
    ).toContain(pkg.version)
  })

  it('has package.json matching the newest notes', () => {
    const all = loadAll()
    const newest = sortReleases(all.map((a) => a.release))[0]
    expect(newest.version, 'the newest release notes and package.json disagree').toBe(pkg.version)
  })

  it('say something in every one', () => {
    for (const { file, release } of loadAll()) {
      expect(release.title.length, `${file} has an empty title`).toBeGreaterThan(0)
      expect(release.summary.length, `${file} has an empty summary`).toBeGreaterThan(0)
      expect(release.highlights.length, `${file} lists no changes`).toBeGreaterThan(0)
      for (const h of release.highlights) {
        expect(h.text.length, `${file} has an empty bullet`).toBeGreaterThan(0)
        expect(CATEGORIES).toContain(h.category)
      }
    }
  })
})
