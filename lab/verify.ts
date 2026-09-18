// Ingest the lab through SPYDR's own LDAP provider and print what the engine finds.
import { ingestDirectory } from '../electron/directory/ldapProvider'

const snap = await ingestDirectory({
  domain: 'harborview.local',
  host: process.env.LAB_HOST ?? '127.0.0.1',
  port: 636,
  protocol: 'ldaps',
  bindUsername: process.env.LAB_USER ?? 'HARBORVIEW\\Administrator',
  password: process.env.LAB_PASS ?? 'Harbor!Lab2026',
  trustServerCert: true,
  baseDn: '',
  rememberPassword: false
})
const types = new Map<string, number>()
for (const f of snap.findings) types.set(f.type, (types.get(f.type) ?? 0) + 1)
console.log(JSON.stringify({ domain: snap.domain, boundAs: snap.boundAs, stats: snap.stats, findingTypes: Object.fromEntries(types) }, null, 2))
