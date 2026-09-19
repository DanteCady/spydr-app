import { app, BrowserWindow, dialog, ipcMain, nativeImage, session, shell } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { discoverDcs, windowsPrefill } from './directory/discoverDc'
import { ingestDirectory, testConnection } from './directory/ldapProvider'
import { buildMenu, usesCustomTitleBar } from './menu'
import { getSettings, resetSettings, settingsPath, updateSettings } from './settings'
import { checkForUpdate, type UpdateCheck } from './updates'
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

/**
 * app.getVersion() answers with Electron's own version when it cannot find our package.json, which
 * happens whenever main is launched by file path rather than by project directory. Read it directly
 * in development so the About section never reports the runtime as the product.
 */
function appVersion(): string {
  if (app.isPackaged) return app.getVersion()
  for (const dir of [app.getAppPath(), process.cwd(), join(__dirname, '../..')]) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: string; version?: string }
      if (pkg.name === 'spydr' && pkg.version) return pkg.version
    } catch {
      /* try the next candidate */
    }
  }
  return app.getVersion()
}

function appIcon(): Electron.NativeImage | undefined {
  const png = [join(__dirname, '../../resources/icon.png'), join(process.cwd(), 'resources/icon.png')].find(existsSync)
  if (!png) return undefined
  const image = nativeImage.createFromPath(png)
  return image.isEmpty() ? undefined : image
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
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // The window renders one document: ours. Anything else — a stray link, an injected redirect —
  // would otherwise inherit the preload bridge and with it the ability to bind to a directory.
  win.webContents.on('will-navigate', (evt, url) => {
    if (isOwnDocument(url)) return
    evt.preventDefault()
    if (/^https?:/.test(url)) void shell.openExternal(url)
  })
  win.webContents.on('will-attach-webview', (evt) => evt.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function registerIpc(): void {
  ipcMain.handle('spydr:prefill', () => windowsPrefill())
  ipcMain.handle('spydr:discover', async (_evt, domain: string) => discoverDcs(domain))
  ipcMain.handle('spydr:test', async (_evt, input: ConnectionInput) => testConnection(input))
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
    const snapshot = await ingestDirectory(input, tuning())
    // toProfile strips the password. Deriving the profile here, rather than accepting one over
    // IPC, means the renderer never has to be trusted to do that stripping.
    lastProfile = toProfile(input)
    liveBind = input
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
  ipcMain.handle('spydr:session:save', (_evt, payload: { snapshot: DirectorySnapshot; view: SessionView }) =>
    saveSession(payload.snapshot, payload.snapshot.source === 'ldap' ? lastProfile : null, payload.view)
  )
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
  ipcMain.handle('spydr:timeline:stats', () => ({ entries: countEntries(), path: timelinePath() }))
  ipcMain.handle('spydr:about', () => ({
    version: appVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    settingsPath: settingsPath(),
    userData: app.getPath('userData'),
    packaged: app.isPackaged
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

void app.whenReady().then(() => {
  const icon = appIcon()
  if (icon) app.dock?.setIcon(icon)
  session.defaultSession.on('will-download', (_evt, item) => {
    item.setSavePath(join(app.getPath('downloads'), item.getFilename()))
  })
  registerIpc()
  pruneEntries(getSettings().privacy.historyRetentionDays)
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
