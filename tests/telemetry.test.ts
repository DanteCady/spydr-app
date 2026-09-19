import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { ALLOWED_KEYS, bucket, buildPayload, minutesBucket, sanitize } from '../shared/telemetry'

const snapshot = loadContosoFixture()

const facts = {
  install: 'a1f3-random',
  version: '0.1.0',
  os: 'win32',
  arch: 'x64',
  workspacesUsed: ['directory', 'pathfinder', 'directory'] as const,
  snapshot,
  domainCount: 1,
  reportsGenerated: 2,
  sessionMinutes: 42
}

describe('buildPayload', () => {
  it('carries nothing that could identify a directory or a person', () => {
    const payload = buildPayload({ ...facts, workspacesUsed: [...facts.workspacesUsed] })
    const json = JSON.stringify(payload).toLowerCase()
    // Every name, domain and distinguished name in the fixture must be absent.
    expect(json).not.toContain('contoso')
    expect(json).not.toContain('dc=')
    for (const node of snapshot.nodes) {
      if (node.sAMAccountName) expect(json).not.toContain(node.sAMAccountName.toLowerCase())
      expect(json).not.toContain(node.displayName.toLowerCase())
    }
  })

  it('reports size as a range rather than a count', () => {
    const payload = buildPayload({ ...facts, workspacesUsed: [...facts.workspacesUsed] })
    expect(payload.objectsBucket).toBe('1-99')
    expect(payload.findingsBucket).toBe('1-99')
    expect(payload.sessionMinutesBucket).toBe('30-120')
    // The exact object count must not appear anywhere.
    expect(JSON.stringify(payload)).not.toContain(String(snapshot.nodes.length))
  })

  it('deduplicates and sorts the workspaces used', () => {
    const payload = buildPayload({ ...facts, workspacesUsed: ['web', 'directory', 'web'] })
    expect(payload.workspacesUsed).toEqual(['directory', 'web'])
  })

  it('handles a run where no directory was ever opened', () => {
    const payload = buildPayload({ ...facts, snapshot: null, domainCount: 0, workspacesUsed: [] })
    expect(payload.objectsBucket).toBe('0')
    expect(payload.domainCount).toBe(0)
  })
})

describe('bucket', () => {
  it('never reveals an exact size', () => {
    expect(bucket(0)).toBe('0')
    expect(bucket(1)).toBe('1-99')
    expect(bucket(450)).toBe('100-999')
    expect(bucket(9_999)).toBe('1k-10k')
    expect(bucket(45_000)).toBe('10k-100k')
    expect(bucket(1_000_000)).toBe('100k+')
    expect(minutesBucket(3)).toBe('0-5')
    expect(minutesBucket(900)).toBe('120+')
  })
})

describe('sanitize', () => {
  it('drops anything not on the allow list, whatever a caller adds', () => {
    const sneaky = {
      ...buildPayload({ ...facts, workspacesUsed: [...facts.workspacesUsed] }),
      domain: 'corp.example.com',
      userName: 'alice'
    }
    const clean = sanitize(sneaky as never) as Record<string, unknown>
    expect(Object.keys(clean).sort()).toEqual([...ALLOWED_KEYS].sort())
    expect(clean.domain).toBeUndefined()
    expect(clean.userName).toBeUndefined()
  })
})
