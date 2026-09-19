import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { rescoreSnapshot } from '../shared/enrich'
import { DEFAULT_SETTINGS } from '../shared/settings'

const base = loadContosoFixture()

describe('rescoreSnapshot', () => {
  it('reproduces the shipped findings with the default settings', () => {
    const again = rescoreSnapshot(base, DEFAULT_SETTINGS.hygiene)
    expect(again.findings.map((f) => f.id).sort()).toEqual(base.findings.map((f) => f.id).sort())
    expect(again.stats.hygieneScore).toBe(base.stats.hygieneScore)
  })

  it('drops a rule when it is disabled, and lifts the score', () => {
    const without = rescoreSnapshot(base, {
      ...DEFAULT_SETTINGS.hygiene,
      disabledRules: ['privileged-nested-path']
    })
    expect(without.findings.some((f) => f.type === 'privileged-nested-path')).toBe(false)
    expect(without.stats.hygieneScore).toBeGreaterThan(base.stats.hygieneScore)
  })

  it('finds more stale accounts as the threshold tightens', () => {
    const stale = (days: number) =>
      rescoreSnapshot(base, { ...DEFAULT_SETTINGS.hygiene, staleDays: days }).findings.filter(
        (f) => f.type === 'stale-in-group'
      ).length
    expect(stale(1)).toBeGreaterThanOrEqual(stale(3650))
  })

  it('treats a named group as privileged and reports the paths into it', () => {
    // Tier0 has IT-Admins nested inside it, so naming it privileged exposes paths that reach it
    // indirectly — exactly what an admin adds their own Tier-0 group for.
    const named = rescoreSnapshot(base, { ...DEFAULT_SETTINGS.hygiene, privilegedGroups: ['Tier0'] })
    expect(named.nodes.find((n) => n.sAMAccountName === 'Tier0')?.privileged).toBe(true)
    const paths = (s: typeof base) => s.findings.filter((f) => f.type === 'privileged-nested-path')
    expect(paths(named).length).toBeGreaterThan(paths(base).length)
    expect(paths(named).some((f) => f.title.includes('Tier0'))).toBe(true)
  })
})
