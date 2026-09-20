import { app, BrowserWindow, dialog, ipcMain, nativeImage, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { discoverDcs, windowsPrefill } from './directory/discoverDc'
import { ingestDirectory, testConnection } from './directory/ldapProvider'
import { buildMenu, usesCustomTitleBar } from './menu'
import { getSettings, resetSettings, settingsPath, updateSettings } from './settings'
import { checkForUpdate, type UpdateCheck } from './updates'
import { activate, canVerify, deactivate, licenceState, refreshLicence } from './license'
import { siteBase } from './endpoints'
import { appVersion } from './version'
import { currentPayload, maybeSend, noteReport, noteSnapshot, noteWorkspace, sendNow } from './telemetry'
import {
  clearTimeline,
  closeTimeline,
  countEntries,
  getEntry,
  listEntries,
  objectHistory,
  pruneEntries,
  recordRead,
  timelinePath
} from './timeline'
import { generateSampleTimeline } from './sampleTimeline'
import { diffSnapshots } from '../shared/diff'
import { readScope, sameScope, worthRecording } from '../shared/timeline'
import type { SettingsPatch } from '../shared/settings'
import { reportFileName, writeReportPdf, type ReportResult } from './report'
import {
  clearSession,
  loadSession,
  loadSessionMeta,
  saveSession,
  toProfile,
  type SessionProfile,
  type SessionView
} from './directory/session'
import type { MenuRole } from '../shared/menu'
import type { ConnectionInput, DirectorySnapshot } from '../shared/types'

app.setName('SPYDR')

const TITLE_BAR_HEIGHT = 36

/** Connection details of the live bind, minus the password. Memory only; never leaves main. */
let lastProfile: SessionProfile | null = null

/**
 * The credentials of the live bind, password included, so the directory can be read again without
 * asking for it. Memory only, in main only: it is never sent to the renderer, never written to the
 * session file, and dropped on disconnect or quit.
 */
let liveBind: ConnectionInput | null = null

/** The previous read, kept to diff the next one against. Memory only. */
let lastRead: { snapshot: DirectorySnapshot; scope: ReturnType<typeof readScope> } | null = null

/**
 * Records what a read changed. Only with consent — this is directory data on disk, and the same
 * question that governs the session snapshot governs the timeline.
 */
function noteRead(snapshot: DirectorySnapshot): void {
  const settings = getSettings()
  const scope = readScope(snapshot, settings)
  const comparable =
    lastRead && lastRead.snapshot.domain === snapshot.domain && sameScope(lastRead.scope, scope) ? lastRead.snapshot : null
  const diff = comparable ? diffSnapshots(comparable, snapshot) : null
  lastRead = { snapshot, scope }
  if (settings.privacy.sessionConsent !== 'yes') return
  if (!worthRecording(diff)) return
  recordRead({ snapshot, diff, scope })
}

function preloadPath(): string {
  const js = join(__dirname, '../preload/preload.js')
  const mjs = join(__dirname, '../preload/preload.mjs')
  return existsSync(js) ? js : mjs
}


function appIcon(): Electron.NativeImage | undefined {
  const png = [join(__dirname, '../../resources/icon.png'), join(process.cwd(), 'resources/icon.png')].find(existsSync)
  if (!png) return undefined
  const image = nativeImage.createFromPath(png)
  return image.isEmpty() ? undefined : image
}

/**
 * The only schemes SPYDR will hand to the operating system.
 *
 * openExternal gives a URL to whatever the OS has registered for it, and SPYDR is typically run by
 * someone holding domain administrator credentials. On Windows a `file://` or `smb://` link to an
 * attacker's host makes the machine authenticate outbound and leak that account's NetNTLM hash
 * without a prompt; `ms-msdt:` and `search-ms:` are the same shape of problem. Nothing in this app
 * needs to open anything but a web page.
 */
function isSafeExternal(url: string): boolean {
  try {
    return ['https:', 'http:'].includes(new URL(url).protocol)
  } catch {
    return false
  }
}

/** The renderer's own document: the dev server in development, the packaged file otherwise. */
function isOwnDocument(url: string): boolean {
  const dev = process.env.ELECTRON_RENDERER_URL
  if (dev && url.startsWith(dev)) return true
  return url.startsWith('file://') && url.includes('/renderer/')
}

function createWindow(): void {
  const icon = appIcon()
  const custom = usesCustomTitleBar()
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#101216',
    title: 'SPYDR',
    show: false,
    // Where the renderer draws the bar, the OS still paints the window buttons over it.
    ...(custom
      ? {
          titleBarStyle: 'hidden' as const,
          titleBarOverlay: { color: '#00000000', symbolColor: '#8b9bb0', height: TITLE_BAR_HEIGHT }
        }
      : {}),
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  // The accelerators live on the native menu, so it stays in place; the strip is just hidden.
  if (custom) {
    win.setMenuBarVisibility(false)
    win.autoHideMenuBar = true
  }
  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternal(details.url)) void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // The window renders one document: ours. Anything else — a stray link, an injected redirect —
  // would otherwise inherit the preload bridge and with it the ability to bind to a directory.
  win.webContents.on('will-navigate', (evt, url) => {
    if (isOwnDocument(url)) return
    evt.preventDefault()
    if (isSafeExternal(url)) void shell.openExternal(url)
  })
  win.webContents.on('will-attach-webview', (evt) => evt.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * A DNS name, loosely: labels of letters, digits and hyphens, separated by dots.
 *
 * discoverDcs concatenates this into an SRV lookup, so without a bound on it the renderer has a
 * general-purpose DNS channel — every query goes out to a resolver, and the name itself is the
 * message. Directory data is attacker-written in a compromised domain, so this is worth closing
 * even though the renderer is ours.
 */
function isHostish(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 253 && /^[A-Za-z0-9._-]+$/.test(value)
}

/**
 * The renderer chooses where to bind, because that is where the user types it. It does not get to
 * choose anything the shape of which we cannot check first.
 */
function validConnection(input: unknown): input is ConnectionInput {
  if (!input || typeof input !== 'object') return false
  const c = input as Record<string, unknown>
  return (
    isHostish(c.host) &&
    typeof c.port === 'number' &&
    Number.isInteger(c.port) &&
    c.port >= 1 &&
    c.port <= 65535 &&
    (c.protocol === 'ldap' || c.protocol === 'ldaps' || c.protocol === 'starttls') &&
    typeof c.domain === 'string' &&
    c.domain.length <= 253 &&
    typeof c.bindUsername === 'string' &&
    c.bindUsername.length <= 256 &&
    typeof c.bindPassword === 'string' &&
    typeof c.baseDn === 'string' &&
    c.baseDn.length <= 1024
  )
}

const REJECTED = 'That connection is not valid. Check the host, port and protocol.'

function registerIpc(): void {
  ipcMain.handle('spydr:prefill', () => windowsPrefill())
  ipcMain.handle('spydr:discover', async (_evt, domain: string) => {
    if (!isHostish(domain)) return []
    return discoverDcs(domain)
  })
  ipcMain.handle('spydr:test', async (_evt, input: ConnectionInput) => {
    if (!validConnection(input)) throw new Error(REJECTED)
    return testConnection(input)
  })
  const tuning = () => {
    const { connection, hygiene } = getSettings()
    return {
      pageSize: connection.pageSize,
      searchTimeout: connection.searchTimeout,
      connectTimeout: connection.connectTimeout,
      includeComputers: connection.includeComputers,
      includeContainers: connection.includeContainers,
      hygiene
    }
  }

  ipcMain.handle('spydr:ingest', async (_evt, input: ConnectionInput) => {
    if (!validConnection(input)) throw new Error(REJECTED)
    const snapshot = await ingestDirectory(input, tuning())
    // toProfile strips the password. Deriving the profile here, rather than accepting one over
    // IPC, means the renderer never has to be trusted to do that stripping.
    lastProfile = toProfile(input)
    liveBind = input
    noteSnapshot(snapshot.domain, snapshot.stats)
    noteRead(snapshot)
    return snapshot
  })
  // Read the same directory again with the credentials already in memory. The renderer asks; it
  // never holds the password to ask with.
  ipcMain.handle('spydr:refresh', async () => {
    if (!liveBind) throw new Error('No live connection to refresh. Connect to the directory again.')
    const snapshot = await ingestDirectory(liveBind, tuning())
    noteRead(snapshot)
    return snapshot
  })
  ipcMain.on('spydr:can-refresh', (evt) => {
    evt.returnValue = liveBind !== null
  })
  ipcMain.handle('spydr:forget-bind', () => {
    liveBind = null
    lastProfile = null
    lastRead = null
  })
  ipcMain.handle('spydr:session:peek', () => loadSessionMeta())
  ipcMain.handle('spydr:session:restore', () => loadSession())
  // There is one session slot. The sample must never take it: it would overwrite a real read and
  // the profile needed to reconnect, and it can always be rebuilt from the fixture anyway. The
  // renderer already declines to ask, and this is the half that holds if it ever stops.
  ipcMain.handle('spydr:session:save', (_evt, payload: { snapshot: DirectorySnapshot; view: SessionView }) => {
    if (payload?.snapshot?.source !== 'ldap') return
    return saveSession(payload.snapshot, lastProfile, payload.view)
  })
  ipcMain.handle('spydr:session:clear', () => clearSession())
  ipcMain.handle('spydr:report', async (evt, snapshot: DirectorySnapshot): Promise<ReportResult | null> => {
    const win = BrowserWindow.fromWebContents(evt.sender)
    const options = {
      title: 'Save hygiene report',
      defaultPath: join(app.getPath('downloads'), reportFileName(snapshot)),
      filters: [{ name: 'PDF document', extensions: ['pdf'] }]
    }
    const { canceled, filePath } = win
      ? await dialog.showSaveDialog(win, options)
      : await dialog.showSaveDialog(options)
    if (canceled || !filePath) return null
    noteReport()
    const result = await writeReportPdf(snapshot, filePath, getSettings().report)
    if (getSettings().report.openAfterSave) void shell.openPath(result.path)
    return result
  })
  ipcMain.on('spydr:settings:sync', (evt) => {
    // Synchronous so the first paint already has the right theme; writes are async.
    evt.returnValue = getSettings()
  })
  ipcMain.handle('spydr:settings:set', (_evt, patch: SettingsPatch) => updateSettings(patch))
  ipcMain.handle('spydr:settings:reset', () => resetSettings())
  ipcMain.handle('spydr:updates:check', (): Promise<UpdateCheck> => checkForUpdate(getSettings().updates.feedUrl, appVersion()))
  ipcMain.handle('spydr:timeline:list', (_evt, domain?: string) => listEntries(domain))
  ipcMain.handle('spydr:timeline:get', (_evt, id: string) => getEntry(id))
  ipcMain.handle('spydr:timeline:object', (_evt, objectGuid: string) => objectHistory(objectGuid))
  ipcMain.handle('spydr:timeline:clear', () => clearTimeline())
  ipcMain.handle('spydr:timeline:sample', () => generateSampleTimeline())
  ipcMain.handle('spydr:timeline:stats', () => ({ entries: countEntries(), path: timelinePath() }))
  ipcMain.handle('spydr:telemetry:preview', () => currentPayload())
  ipcMain.handle('spydr:telemetry:send', () => sendNow())
  ipcMain.on('spydr:telemetry:workspace', (_evt, workspace: string) => noteWorkspace(workspace as never))
  ipcMain.handle('spydr:licence:state', () => licenceState())
  ipcMain.handle('spydr:licence:activate', (_evt, key: string) => activate(key))
  ipcMain.handle('spydr:licence:deactivate', () => deactivate())
  ipcMain.handle('spydr:about', () => ({
    version: appVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    settingsPath: settingsPath(),
    userData: app.getPath('userData'),
    packaged: app.isPackaged,
    licenceVerifiable: canVerify(),
    site: siteBase()
  }))
  ipcMain.on('spydr:chrome', (evt) => {
    evt.returnValue = {
      custom: usesCustomTitleBar(),
      platform: process.platform,
      titleBarHeight: TITLE_BAR_HEIGHT
    }
  })
  ipcMain.handle('spydr:role', (evt, role: string) => {
    // Allowlisted by name. Looking the role up on webContents would let the renderer call any
    // method on it — including ones that open devtools or navigate the window.
    const wc = BrowserWindow.fromWebContents(evt.sender)?.webContents
    if (!wc) return
    const actions: Record<MenuRole, () => void> = {
      undo: () => wc.undo(),
      redo: () => wc.redo(),
      cut: () => wc.cut(),
      copy: () => wc.copy(),
      paste: () => wc.paste(),
      selectAll: () => wc.selectAll()
    }
    actions[role as MenuRole]?.()
  })
}

/**
 * What the renderer is allowed to do, enforced by Chromium rather than by our own care.
 *
 * SPYDR renders directory data, and in a compromised domain every name, description and DN in it
 * is written by the attacker. React escapes all of it today and there is no innerHTML anywhere —
 * but this is the control that decides what a future slip is worth. `connect-src 'none'` is the
 * important one: the renderer makes no network calls at all (everything goes over IPC), so an
 * injected script has nowhere to send the directory it can read through the bridge.
 */
function applyCsp(): void {
  const dev = process.env.ELECTRON_RENDERER_URL
  const policy = dev
    ? // Vite's client needs its own socket and eval to hot-reload.
      `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http://localhost:*; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`
    : `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'`

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [policy] } })
  })

  // Nothing here needs a camera, a microphone, a location or a notification. Deny the lot rather
  // than relying on Chromium's defaults for the file:// origin the packaged app runs from.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, deny) => deny(false))
}

void app.whenReady().then(() => {
  applyCsp()
  const icon = appIcon()
  if (icon) app.dock?.setIcon(icon)
  // SPYDR saves exactly one thing, the report, and it does that through a save dialog rather than
  // a download. So a download reaching here was started by the page, not by the user — cancel it
  // instead of silently dropping a file into Downloads next to the reports they do trust.
  session.defaultSession.on('will-download', (evt) => evt.preventDefault())
  registerIpc()
  pruneEntries(getSettings().privacy.historyRetentionDays)
  // The monthly re-check, once the window is up and out of the way of first paint.
  setTimeout(() => void refreshLicence(), 8_000)
  setTimeout(() => void maybeSend(), 20_000)
  buildMenu()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  liveBind = null
  lastRead = null
  closeTimeline()
  if (getSettings().privacy.forgetOnQuit) clearSession()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
