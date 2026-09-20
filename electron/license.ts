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
 * due while a machine is offline, SPYDIR keeps working and says so rather than locking an admin out
 * of a read-only tool during an incident.
 */

interface Stored {
  payload: string
  signature: string
  checkedAt: string
}

function file(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 })
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

/**
 * A licence is only what the server signed.
 *
 * With no public key there is no way to tell a real activation from a hand-written one, so this
 * refuses rather than trusts. Failing open here would make the file in userData — which is plain
 * base64 JSON, sitting in the user's own home directory — authoritative about tier and features,
 * which is exactly backwards.
 */
function verify(stored: Stored): SignedLicence | null {
  const pem = publicKeyPem()
  if (!pem) return null
  const json = Buffer.from(stored.payload, 'base64').toString('utf8')
  try {
    const ok = edVerify(null, Buffer.from(json, 'utf8'), createPublicKey(pem), Buffer.from(stored.signature, 'base64'))
    if (!ok) return null
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
  writeFileSync(tmp, JSON.stringify(stored, null, 2), { encoding: 'utf8', mode: 0o600 })
  renameSync(tmp, file())
}

let cache: LicenceState | null = null

function toState(stored: Stored, message?: string): LicenceState {
  const licence = verify(stored)
  if (!licence) {
    // Worth telling these apart: one is a build problem the user cannot do anything about, the
    // other is a licence that does not match what the server signed.
    return {
      ...UNLICENSED,
      status: 'lapsed',
      message: canVerify()
        ? 'The stored licence does not match the signature it came with. Enter your key again.'
        : 'This build cannot check licence signatures, so the stored licence was not trusted. Please reinstall SPYDIR.'
    }
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

async function callActivate(
  key: string
): Promise<{ ok: true; stored: Stored } | { ok: false; error: string; withdrawn?: boolean }> {
  try {
    const res = await net.fetch(`${apiBase()}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, machine: machineId(), version: appVersion(), os: process.platform })
    })
    // 404 and 403 are the server's verdict on the key itself, not a failure to reach it. That
    // distinction decides whether a re-check may fall back on the cached licence.
    if (res.status === 404) {
      return { ok: false, error: 'That key is not recognised. Check it and try again.', withdrawn: true }
    }
    if (res.status === 403) {
      return { ok: false, error: 'That key is no longer valid. Sign up again for a new one.', withdrawn: true }
    }
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
    return { ...UNLICENSED, message: 'That key is not in the right shape. It looks like SPYDIR-XXXXX-XXXXX-XXXXX-XXXXX.' }
  }
  const result = await callActivate(key)
  if (!result.ok) return { ...licenceState(), message: result.error }
  try {
    write(result.stored)
  } catch {
    // Every other failure here travels as a message on the returned state. A throw would skip that
    // channel entirely and leave the screen unchanged, which reads as nothing having happened —
    // the worst answer for someone on a locked-down machine typing a key that is actually fine.
    return {
      ...UNLICENSED,
      message: 'Your key is good, but the licence could not be saved to this machine. Check that SPYDIR can write to its application data folder.'
    }
  }
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
    // Grace exists for a machine that cannot reach the server — not for a key the server has
    // answered about. A withdrawn key is lapsed now, rather than good for another three weeks.
    if (result.withdrawn) {
      cache = { ...UNLICENSED, status: 'lapsed', keyHint: keyHint(licence.key), message: result.error }
      return cache
    }
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
