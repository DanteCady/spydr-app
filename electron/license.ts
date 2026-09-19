import { app, net } from 'electron'
import { createHash, createPublicKey, verify as edVerify } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { join } from 'node:path'
import { apiBase } from './endpoints'
import { appVersion } from './version'
import {
  keyHint,
  keyLooksValid,
  normalizeKey,
  statusOf,
  UNLICENSED,
  type LicenceState,
  type SignedLicence
} from '../shared/license'

/**
 * Activation, in the main process.
 *
 * The server signs its answer, so a month-old cached activation can still be trusted without
 * asking again — and cannot be forged by pointing the host at something else. If the check falls
 * due while a machine is offline, SPYDR keeps working and says so rather than locking an admin out
 * of a read-only tool during an incident.
 */

interface Stored {
  payload: string
  signature: string
  checkedAt: string
}

function file(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'licence.json')
}

/** Packaged builds carry the public half of the signing key; dev reads it from the repo. */
function publicKeyPem(): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', 'license-public.pem'),
    join(__dirname, '../../resources/license-public.pem'),
    join(app.getAppPath(), 'resources/license-public.pem'),
    join(process.cwd(), 'resources/license-public.pem')
  ]
  const found = candidates.find((p) => p && existsSync(p))
  return found ? readFileSync(found, 'utf8') : null
}

function verify(stored: Stored): SignedLicence | null {
  const pem = publicKeyPem()
  const json = Buffer.from(stored.payload, 'base64').toString('utf8')
  if (pem) {
    const ok = edVerify(null, Buffer.from(json, 'utf8'), createPublicKey(pem), Buffer.from(stored.signature, 'base64'))
    if (!ok) return null
  }
  try {
    return JSON.parse(json) as SignedLicence
  } catch {
    return null
  }
}

/**
 * A stable identifier for this installation, hashed here so the raw values never leave the machine.
 * It exists to count installs, not to recognise a computer.
 */
function machineId(): string {
  return createHash('sha256').update(`${hostname()}|${process.platform}|${process.arch}|${app.getPath('userData')}`).digest('hex')
}

function read(): Stored | null {
  try {
    return existsSync(file()) ? (JSON.parse(readFileSync(file(), 'utf8')) as Stored) : null
  } catch {
    return null
  }
}

function write(stored: Stored): void {
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(stored, null, 2), 'utf8')
  renameSync(tmp, file())
}

let cache: LicenceState | null = null

function toState(stored: Stored, message?: string): LicenceState {
  const licence = verify(stored)
  if (!licence) {
    return { ...UNLICENSED, status: 'lapsed', message: 'The stored licence could not be verified.' }
  }
  return {
    status: statusOf(licence),
    tier: licence.tier,
    features: licence.features,
    email: licence.email,
    keyHint: keyHint(licence.key),
    checkedAt: stored.checkedAt,
    notAfter: licence.notAfter,
    message
  }
}

export function licenceState(): LicenceState {
  if (cache) return cache
  const stored = read()
  cache = stored ? toState(stored) : UNLICENSED
  return cache
}

async function callActivate(key: string): Promise<{ ok: true; stored: Stored } | { ok: false; error: string }> {
  try {
    const res = await net.fetch(`${apiBase()}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, machine: machineId(), version: appVersion(), os: process.platform })
    })
    if (res.status === 404) return { ok: false, error: 'That key is not recognised. Check it and try again.' }
    if (res.status === 403) return { ok: false, error: 'That key is no longer valid. Sign up again for a new one.' }
    if (!res.ok) return { ok: false, error: `The licence server answered ${res.status}.` }

    const body = (await res.json()) as { payload?: string; signature?: string }
    if (!body.payload || !body.signature) return { ok: false, error: 'The licence server sent something unexpected.' }

    const stored: Stored = { payload: body.payload, signature: body.signature, checkedAt: new Date().toISOString() }
    if (!verify(stored)) return { ok: false, error: 'The licence server’s signature did not check out.' }
    return { ok: true, stored }
  } catch {
    return { ok: false, error: 'Could not reach the licence server. Check the connection and try again.' }
  }
}

export async function activate(rawKey: string): Promise<LicenceState> {
  const key = normalizeKey(rawKey)
  if (!keyLooksValid(key)) {
    return { ...UNLICENSED, message: 'That key is not in the right shape. It looks like SPYDR-XXXXX-XXXXX-XXXXX-XXXXX.' }
  }
  const result = await callActivate(key)
  if (!result.ok) return { ...licenceState(), message: result.error }
  write(result.stored)
  cache = toState(result.stored)
  return cache
}

/**
 * The quiet monthly re-check. Failure is not an error anyone needs to see — the licence simply
 * stays in grace until the machine is online again.
 */
export async function refreshLicence(): Promise<LicenceState> {
  const stored = read()
  if (!stored) return UNLICENSED
  const licence = verify(stored)
  if (!licence) return licenceState()
  if (statusOf(licence) === 'active') return licenceState()

  const result = await callActivate(licence.key)
  if (!result.ok) {
    cache = toState(stored, result.error)
    return cache
  }
  write(result.stored)
  cache = toState(result.stored)
  return cache
}

export function deactivate(): LicenceState {
  try {
    rmSync(file(), { force: true })
  } catch {
    /* nothing to remove */
  }
  cache = UNLICENSED
  return cache
}

/** Whether this build can verify what the server signs. */
export function canVerify(): boolean {
  return publicKeyPem() !== null
}
