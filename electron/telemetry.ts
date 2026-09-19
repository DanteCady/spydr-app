import { net } from 'electron'
import { randomUUID } from 'node:crypto'
import { buildPayload, sanitize, type TelemetryPayload, type UsageFacts } from '../shared/telemetry'
import { getSettings, updateSettings } from './settings'
import { appVersion } from './version'
import type { WorkspaceId } from '../shared/types'

/**
 * Usage reporting, off unless switched on.
 *
 * Facts accumulate in memory during a run and are sent at most once every few days. Nothing is
 * queued to disk: if a send fails, that report is simply lost, which is the correct trade for data
 * this unimportant. The payload is built by shared code so Settings can show exactly what would be
 * sent, rather than a description of it.
 */

const SEND_EVERY_MS = 3 * 86_400_000

interface Run {
  startedAt: number
  workspaces: Set<WorkspaceId>
  domains: Set<string>
  reports: number
  snapshot: UsageFacts['snapshot']
}

const run: Run = { startedAt: Date.now(), workspaces: new Set(), domains: new Set(), reports: 0, snapshot: null }

/** A random identifier for this installation, kept in settings so clearing them resets it. */
function installId(): string {
  const current = getSettings().privacy.telemetryInstallId
  if (current) return current
  const fresh = randomUUID()
  updateSettings({ privacy: { telemetryInstallId: fresh } })
  return fresh
}

export function noteWorkspace(workspace: WorkspaceId): void {
  run.workspaces.add(workspace)
}

export function noteSnapshot(domain: string, stats: NonNullable<UsageFacts['snapshot']>['stats']): void {
  run.domains.add(domain)
  run.snapshot = { stats }
}

export function noteReport(): void {
  run.reports += 1
}

export function currentPayload(): TelemetryPayload {
  return sanitize(
    buildPayload({
      install: installId(),
      version: appVersion(),
      os: process.platform,
      arch: process.arch,
      workspacesUsed: [...run.workspaces],
      snapshot: run.snapshot,
      domainCount: run.domains.size,
      reportsGenerated: run.reports,
      sessionMinutes: Math.round((Date.now() - run.startedAt) / 60_000)
    })
  )
}

function endpoint(): string {
  return `${process.env.SPYDR_LICENSE_API ?? 'https://getspydr.com'}/api/telemetry`
}

/** Sends now regardless of schedule — used by the "send one now" button in Settings. */
export async function sendNow(): Promise<{ ok: boolean; message: string }> {
  if (!getSettings().privacy.telemetry) return { ok: false, message: 'Telemetry is off.' }
  try {
    const res = await net.fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentPayload())
    })
    if (!res.ok) return { ok: false, message: `The server answered ${res.status}.` }
    updateSettings({ privacy: { telemetryLastSent: new Date().toISOString() } })
    return { ok: true, message: 'Sent.' }
  } catch {
    return { ok: false, message: 'Could not reach the server. Nothing was queued.' }
  }
}

/** Called on a timer; does nothing at all unless telemetry is on and enough time has passed. */
export async function maybeSend(): Promise<void> {
  const { privacy } = getSettings()
  if (!privacy.telemetry) return
  const last = privacy.telemetryLastSent ? new Date(privacy.telemetryLastSent).getTime() : 0
  if (Date.now() - last < SEND_EVERY_MS) return
  await sendNow()
}
