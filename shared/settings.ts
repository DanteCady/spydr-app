import type { FindingType, Protocol } from './types'

/**
 * Everything a user can change, in one shape. Lives in main as a JSON file and is mirrored into the
 * renderer, so both the ingest (page sizes, timeouts) and the UI (canvas, theme) read the same
 * object. Defaults are the values that were hardcoded before this existed, so an untouched install
 * behaves exactly as it did.
 */

/** Build and environment facts for the About section. Read-only, from the main process. */
export interface AboutInfo {
  /** Whether this build carries the key needed to verify a cached activation. */
  licenceVerifiable?: boolean
  /** Where this build gets keys from: production, or the site running next door in development. */
  site?: string
  version: string
  electron: string
  chrome: string
  node: string
  platform: string
  settingsPath: string
  userData: string
  packaged: boolean
}

export type ThemeName = 'dark' | 'light' | 'vivid' | 'minimal' | 'minimal-dark'
export type LayoutMode = 'tree' | 'structure'
export type Density = 'auto' | 'compact' | 'spread'
export type PaperSize = 'Letter' | 'A4'

export interface HygieneSettings {
  /** Days without a logon before a user counts as stale. */
  staleDays: number
  /** Nesting depth above which a group is flagged. */
  deepNesting: number
  /** Max nested paths enumerated per user and privileged group. */
  maxPrivilegedPaths: number
  /** Rules to skip entirely. */
  disabledRules: FindingType[]
  /**
   * sAMAccountNames treated as privileged on top of the AD built-ins. Tier-0 groups are rarely
   * called "Domain Admins" in a real forest.
   */
  privilegedGroups: string[]
}

export interface ConnectionSettings {
  defaultProtocol: Protocol
  /** Entries per LDAP page. Lower it for domain controllers with a tight MaxPageSize. */
  pageSize: number
  /** Seconds to wait for a search to answer. */
  searchTimeout: number
  /** Seconds to wait for the socket to open. */
  connectTimeout: number
  /** Computers can be half of a large directory and are not needed for membership hygiene. */
  includeComputers: boolean
  includeContainers: boolean
  /** Offer to trust a self-signed DC certificate by default. */
  trustServerCert: boolean
}

export interface ReportSettings {
  paper: PaperSize
  /** Findings listed per rule before the rest are summarised as a count. */
  perSection: number
  /** Findings listed in the priorities section. */
  prioritySection: number
  openAfterSave: boolean
}

export interface PrivacySettings {
  /** 'unset' means the question has not been asked yet. Covers the snapshot and the timeline. */
  sessionConsent: 'yes' | 'no' | 'unset'
  /** Drop the saved session when the app quits, keeping restore within a run only. */
  forgetOnQuit: boolean
  /** Days of change history to keep. Zero keeps everything. */
  historyRetentionDays: number
  /** Anonymous usage reporting. Off unless switched on, and never inferred from anything else. */
  telemetry: boolean
  /** Random per installation, created on first send. Clearing settings resets it. */
  telemetryInstallId?: string
  telemetryLastSent?: string
}

export interface AppearanceSettings {
  theme: ThemeName
  canvasGrid: boolean
  canvasLegend: boolean
  canvasLabels: boolean
  canvasDensity: Density
  canvasLayout: LayoutMode
}

export interface UpdateSettings {
  /**
   * An override for where updates are fetched from, for a site that mirrors releases internally
   * rather than letting every machine reach GitHub. Empty means the release feed the build was
   * published with.
   */
  feedUrl: string
  checkOnStart: boolean
  /**
   * Download and stage an update without asking first.
   *
   * Off by default, and deliberately. SPYDIR is run by administrators against production domain
   * controllers, and in those environments bytes arriving unannounced over the network is the sort
   * of thing that turns up in an audit. Nothing is ever applied while the app is open either way —
   * an update is swapped in on quit, so a long directory read can never be interrupted by one.
   */
  automatic: boolean
  /**
   * The newest release whose notes have been shown here. Kept in settings rather than in browser
   * storage so it survives a cache clear and travels with the rest of the app's state.
   *
   * Empty means this install has never been shown any, which is treated as "nothing unread" — a
   * first run should not open on a notification about a version it never missed.
   */
  lastSeenRelease: string
}

export interface AppSettings {
  version: number
  hygiene: HygieneSettings
  connection: ConnectionSettings
  report: ReportSettings
  privacy: PrivacySettings
  appearance: AppearanceSettings
  updates: UpdateSettings
}

export const SETTINGS_VERSION = 1

export const DEFAULT_SETTINGS: AppSettings = {
  version: SETTINGS_VERSION,
  hygiene: {
    staleDays: 90,
    deepNesting: 3,
    maxPrivilegedPaths: 8,
    disabledRules: [],
    privilegedGroups: []
  },
  connection: {
    defaultProtocol: 'ldaps',
    pageSize: 500,
    searchTimeout: 30,
    connectTimeout: 8,
    includeComputers: true,
    includeContainers: true,
    trustServerCert: false
  },
  report: {
    paper: 'Letter',
    perSection: 24,
    prioritySection: 10,
    openAfterSave: true
  },
  privacy: {
    sessionConsent: 'unset',
    forgetOnQuit: false,
    historyRetentionDays: 90,
    telemetry: false
  },
  appearance: {
    theme: 'dark',
    canvasGrid: false,
    canvasLegend: true,
    canvasLabels: true,
    canvasDensity: 'auto',
    canvasLayout: 'tree'
  },
  updates: {
    feedUrl: '',
    checkOnStart: false,
    automatic: false,
    lastSeenRelease: ''
  }
}

/** Bounds for the numeric settings, so a typo cannot make the app unusable. */
export const LIMITS = {
  staleDays: { min: 1, max: 3650 },
  deepNesting: { min: 1, max: 20 },
  maxPrivilegedPaths: { min: 1, max: 100 },
  pageSize: { min: 10, max: 5000 },
  searchTimeout: { min: 5, max: 600 },
  connectTimeout: { min: 1, max: 120 },
  perSection: { min: 1, max: 500 },
  prioritySection: { min: 1, max: 200 },
  historyRetentionDays: { min: 0, max: 3650 }
} as const

function clamp(value: unknown, fallback: number, bounds: { min: number; max: number }): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(bounds.max, Math.max(bounds.min, Math.round(n)))
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string') continue
    const trimmed = entry.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

const RULE_IDS: FindingType[] = [
  'circular-nesting',
  'deep-nesting',
  'empty-security-group',
  'disabled-in-group',
  'stale-in-group',
  'redundant-membership',
  'privileged-nested-path',
  'distribution-in-security'
]

/**
 * Anything on disk, from an older version or hand-edited, becomes a valid AppSettings. Unknown keys
 * are dropped and out-of-range numbers are clamped rather than rejected — a bad settings file must
 * never stop the app from starting.
 */
export function normalizeSettings(raw: unknown): AppSettings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const section = <K extends keyof AppSettings>(key: K): Record<string, unknown> => {
    const value = input[key as string]
    return (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  }

  const h = section('hygiene')
  const c = section('connection')
  const r = section('report')
  const p = section('privacy')
  const a = section('appearance')
  const u = section('updates')
  const d = DEFAULT_SETTINGS

  return {
    version: SETTINGS_VERSION,
    hygiene: {
      staleDays: clamp(h.staleDays, d.hygiene.staleDays, LIMITS.staleDays),
      deepNesting: clamp(h.deepNesting, d.hygiene.deepNesting, LIMITS.deepNesting),
      maxPrivilegedPaths: clamp(h.maxPrivilegedPaths, d.hygiene.maxPrivilegedPaths, LIMITS.maxPrivilegedPaths),
      disabledRules: Array.isArray(h.disabledRules)
        ? RULE_IDS.filter((id) => (h.disabledRules as unknown[]).includes(id))
        : [],
      privilegedGroups: names(h.privilegedGroups)
    },
    connection: {
      defaultProtocol: pick(c.defaultProtocol, ['ldaps', 'ldap', 'starttls'] as const, d.connection.defaultProtocol),
      pageSize: clamp(c.pageSize, d.connection.pageSize, LIMITS.pageSize),
      searchTimeout: clamp(c.searchTimeout, d.connection.searchTimeout, LIMITS.searchTimeout),
      connectTimeout: clamp(c.connectTimeout, d.connection.connectTimeout, LIMITS.connectTimeout),
      includeComputers: bool(c.includeComputers, d.connection.includeComputers),
      includeContainers: bool(c.includeContainers, d.connection.includeContainers),
      trustServerCert: bool(c.trustServerCert, d.connection.trustServerCert)
    },
    report: {
      paper: pick(r.paper, ['Letter', 'A4'] as const, d.report.paper),
      perSection: clamp(r.perSection, d.report.perSection, LIMITS.perSection),
      prioritySection: clamp(r.prioritySection, d.report.prioritySection, LIMITS.prioritySection),
      openAfterSave: bool(r.openAfterSave, d.report.openAfterSave)
    },
    privacy: {
      sessionConsent: pick(p.sessionConsent, ['yes', 'no', 'unset'] as const, d.privacy.sessionConsent),
      forgetOnQuit: bool(p.forgetOnQuit, d.privacy.forgetOnQuit),
      historyRetentionDays: clamp(p.historyRetentionDays, d.privacy.historyRetentionDays, LIMITS.historyRetentionDays),
      telemetry: bool(p.telemetry, d.privacy.telemetry),
      telemetryInstallId: typeof p.telemetryInstallId === 'string' ? p.telemetryInstallId : undefined,
      telemetryLastSent: typeof p.telemetryLastSent === 'string' ? p.telemetryLastSent : undefined
    },
    appearance: {
      theme: pick(a.theme, ['dark', 'light', 'vivid', 'minimal', 'minimal-dark'] as const, d.appearance.theme),
      canvasGrid: bool(a.canvasGrid, d.appearance.canvasGrid),
      canvasLegend: bool(a.canvasLegend, d.appearance.canvasLegend),
      canvasLabels: bool(a.canvasLabels, d.appearance.canvasLabels),
      canvasDensity: pick(a.canvasDensity, ['auto', 'compact', 'spread'] as const, d.appearance.canvasDensity),
      canvasLayout: pick(a.canvasLayout, ['tree', 'structure'] as const, d.appearance.canvasLayout)
    },
    updates: {
      // Only https, so a settings file cannot point the app at a local file or a plaintext host.
      feedUrl: typeof u.feedUrl === 'string' && /^https:\/\//i.test(u.feedUrl.trim()) ? u.feedUrl.trim() : '',
      checkOnStart: bool(u.checkOnStart, d.updates.checkOnStart),
      automatic: bool(u.automatic, d.updates.automatic),
      // A version string and nothing else: this is only ever compared, never displayed or resolved.
      lastSeenRelease:
        typeof u.lastSeenRelease === 'string' && /^\d{1,4}(\.\d{1,4}){0,3}$/.test(u.lastSeenRelease.trim())
          ? u.lastSeenRelease.trim()
          : ''
    }
  }
}

/** A section-wise patch, the shape the renderer sends when one control changes. */
export type SettingsPatch = {
  [K in keyof Omit<AppSettings, 'version'>]?: Partial<AppSettings[K]>
}

export function applyPatch(current: AppSettings, patch: SettingsPatch): AppSettings {
  return normalizeSettings({
    ...current,
    hygiene: { ...current.hygiene, ...patch.hygiene },
    connection: { ...current.connection, ...patch.connection },
    report: { ...current.report, ...patch.report },
    updates: { ...current.updates, ...patch.updates },
    privacy: { ...current.privacy, ...patch.privacy },
    appearance: { ...current.appearance, ...patch.appearance }
  })
}
