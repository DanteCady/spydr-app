import { loadContosoFixture } from '../fixtures/contoso-lab'

const snapshot = loadContosoFixture()
const types = new Map<string, number>()
for (const f of snapshot.findings) {
  types.set(f.type, (types.get(f.type) ?? 0) + 1)
}

console.log(
  JSON.stringify(
    {
      domain: snapshot.domain,
      stats: snapshot.stats,
      findingTypes: Object.fromEntries(types)
    },
    null,
    2
  )
)

const required = [
  'circular-nesting',
  'deep-nesting',
  'empty-security-group',
  'disabled-in-group',
  'stale-in-group',
  'redundant-membership',
  'privileged-nested-path',
  'distribution-in-security'
] as const

const missing = required.filter((t) => !types.has(t))
if (missing.length) {
  console.error('Missing finding types:', missing.join(', '))
  process.exit(1)
}
