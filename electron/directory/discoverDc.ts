import { resolveSrv } from 'node:dns/promises'
import type { DcRecord, WindowsPrefill } from '../../shared/types'

export function windowsPrefill(): WindowsPrefill {
  const domain = process.env.USERDNSDOMAIN?.trim() || undefined
  const netbios = process.env.USERDOMAIN?.trim() || undefined
  const logon = process.env.LOGONSERVER?.trim()
  const host = logon ? logon.replace(/^\\\\/, '') : undefined
  return { domain, host, netbios }
}

export async function discoverDcs(domain: string): Promise<DcRecord[]> {
  const fqdn = domain.trim().replace(/\.$/, '')
  if (!fqdn) return []
  const name = `_ldap._tcp.dc._msdcs.${fqdn}`
  try {
    const records = await resolveSrv(name)
    return records
      .sort((a, b) => a.priority - b.priority || a.weight - b.weight)
      .map((r) => ({
        name: r.name.replace(/\.$/, ''),
        port: r.port,
        priority: r.priority
      }))
  } catch {
    return []
  }
}
