import { describe, expect, it } from 'vitest'
import { applyPatch, DEFAULT_SETTINGS, LIMITS, normalizeSettings } from '../shared/settings'
import { compareVersions, isNewer, parseVersion } from '../shared/version'

describe('normalizeSettings', () => {
  it('returns the defaults for nonsense', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings('not an object')).toEqual(DEFAULT_SETTINGS)
    expect(normalizeSettings({ hygiene: 42 })).toEqual(DEFAULT_SETTINGS)
  })

  it('clamps numbers rather than rejecting the file', () => {
    const s = normalizeSettings({ hygiene: { staleDays: -5, deepNesting: 9999 }, connection: { pageSize: 0 } })
    expect(s.hygiene.staleDays).toBe(LIMITS.staleDays.min)
    expect(s.hygiene.deepNesting).toBe(LIMITS.deepNesting.max)
    expect(s.connection.pageSize).toBe(LIMITS.pageSize.min)
  })

  it('drops unknown rule ids and duplicate group names', () => {
    const s = normalizeSettings({
      hygiene: {
        disabledRules: ['deep-nesting', 'not-a-rule'],
        privilegedGroups: [' Tier0-Admins ', 'tier0-admins', '', 7]
      }
    })
    expect(s.hygiene.disabledRules).toEqual(['deep-nesting'])
    expect(s.hygiene.privilegedGroups).toEqual(['Tier0-Admins'])
  })

  it('accepts only https update feeds, so a settings file cannot redirect the app', () => {
    expect(normalizeSettings({ updates: { feedUrl: 'http://example.com/feed' } }).updates.feedUrl).toBe('')
    expect(normalizeSettings({ updates: { feedUrl: 'file:///etc/passwd' } }).updates.feedUrl).toBe('')
    expect(normalizeSettings({ updates: { feedUrl: ' https://example.com/feed ' } }).updates.feedUrl).toBe(
      'https://example.com/feed'
    )
  })
})

describe('applyPatch', () => {
  it('changes one field and leaves the rest', () => {
    const next = applyPatch(DEFAULT_SETTINGS, { hygiene: { staleDays: 30 } })
    expect(next.hygiene.staleDays).toBe(30)
    expect(next.hygiene.deepNesting).toBe(DEFAULT_SETTINGS.hygiene.deepNesting)
    expect(next.connection).toEqual(DEFAULT_SETTINGS.connection)
  })

  it('validates what it is handed', () => {
    const next = applyPatch(DEFAULT_SETTINGS, { report: { perSection: 10_000 } })
    expect(next.report.perSection).toBe(LIMITS.perSection.max)
  })
})

describe('version compare', () => {
  it('parses and orders releases', () => {
    expect(parseVersion('v1.2.3')?.parts).toEqual([1, 2, 3])
    expect(parseVersion('nonsense')).toBeNull()
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
    expect(isNewer('1.3.0', '1.2.9')).toBe(true)
    expect(isNewer('v0.2.0', '0.10.0')).toBe(false)
    expect(isNewer('2.0.0', '2.0.0-beta.1')).toBe(true)
    expect(isNewer('2.0.0-beta.1', '2.0.0')).toBe(false)
  })

  it('treats an unreadable tag as no update, rather than guessing', () => {
    expect(isNewer('latest', '0.1.0')).toBe(false)
  })
})
