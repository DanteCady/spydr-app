import { describe, expect, it } from 'vitest'
import { loadContosoFixture } from '../fixtures/contoso-lab'
import { buildReport, reportFileName, verdict } from '../shared/report/model'
import { RULES } from '../shared/engine/registry'
import type { DirectorySnapshot } from '../shared/types'

const snapshot = loadContosoFixture()

function blocks(report: ReturnType<typeof buildReport>) {
  return report.sections.flatMap((s) => s.blocks)
}

describe('buildReport', () => {
  it('opens with the overview and closes with the appendix', () => {
    const report = buildReport(snapshot)
    expect(report.sections[0].heading).toBe('What SPYDR found')
    expect(report.sections[1].heading).toBe('What to fix first')
    expect(report.sections.at(-1)?.heading).toBe('Scope and method')
  })

  it('gives every rule that fired its own section, in rule order', () => {
    const report = buildReport(snapshot)
    const fired = RULES.filter((r) => snapshot.findings.some((f) => f.type === r.id)).map((r) => r.name)
    const headings = report.sections.slice(2, -1).map((s) => s.heading)
    expect(headings).toEqual(fired)
  })

  it('lists findings up to the cap and counts the rest', () => {
    const report = buildReport(snapshot, { perSection: 1 })
    const fired = RULES.filter((r) => snapshot.findings.some((f) => f.type === r.id))
    report.sections.slice(2, -1).forEach((section, i) => {
      const total = snapshot.findings.filter((f) => f.type === fired[i].id).length
      const card = section.blocks.find((b) => b.kind === 'findings')
      if (card?.kind !== 'findings') throw new Error(`${section.heading} has no findings block`)
      expect(card.items.length).toBe(1)
      expect(card.items.length + card.omitted).toBe(total)
    })
  })

  it('names the objects behind each finding rather than raw GUIDs', () => {
    const report = buildReport(snapshot)
    const rows = blocks(report).flatMap((b) => (b.kind === 'findings' ? b.items : []))
    expect(rows.length).toBeGreaterThan(0)
    const ids = new Set(snapshot.nodes.map((n) => n.id))
    for (const row of rows) for (const name of row.objects) expect(ids.has(name)).toBe(false)
  })

  it('says so plainly when nothing critical or high fired', () => {
    const clean: DirectorySnapshot = {
      ...snapshot,
      findings: snapshot.findings.filter((f) => f.severity === 'low'),
      stats: { ...snapshot.stats, findings: 0, hygieneScore: 96 }
    }
    const report = buildReport(clean)
    const priorities = report.sections[1]
    expect(priorities.blocks.some((b) => b.kind === 'findings')).toBe(false)
    expect(priorities.blocks[0]).toMatchObject({ kind: 'para' })
  })

  it('carries no password or connection secret into the model', () => {
    const json = JSON.stringify(buildReport(snapshot))
    expect(json.toLowerCase()).not.toContain('password')
  })

  it('grades the score in words', () => {
    expect(verdict(100).word).toBe('Healthy')
    expect(verdict(70).word).toBe('Good')
    expect(verdict(45).word).toBe('Needs attention')
    expect(verdict(44).word).toBe('At risk')
  })
})

describe('reportFileName', () => {
  it('is dated and safe for a filesystem', () => {
    const name = reportFileName({ ...snapshot, domain: 'harbor view/logistics' }, new Date('2026-09-18T12:00:00Z'))
    expect(name).toBe('SPYDR-harbor-view-logistics-hygiene-2026-09-18.pdf')
  })
})
