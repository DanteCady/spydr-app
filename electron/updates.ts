import { app, BrowserWindow } from 'electron'
import type { AppSettings } from '../shared/settings'

/**
 * Updating, on the app's terms rather than its own.
 *
 * SPYDIR is run by administrators against production domain controllers, so the binary changing
 * underneath someone mid-read is not a smoother experience, it is an incident. Three rules follow.
 *
 * Nothing is ever applied while the app is open. An update is staged and swapped in on quit, so a
 * directory read in progress cannot be interrupted by one.
 *
 * Nothing is downloaded without consent unless the operator has turned that on. Bytes arriving
 * unannounced over a customer's network is the sort of thing that turns up in an audit, and the
 * default should not be the one that needs explaining.
 *
 * And nothing is contacted at all until asked. There is no background poll.
 */

export interface UpdateCheck {
  status: 'unconfigured' | 'checking' | 'current' | 'available' | 'downloading' | 'ready' | 'error'
  current: string
  latest?: string
  url?: string
  publishedAt?: string
  notes?: string
  /** 0–100 while downloading. */
  progress?: number
  error?: string
}

type Updater = typeof import('electron-updater').autoUpdater

let updater: Updater | null = null
let state: UpdateCheck = { status: 'unconfigured', current: '0.0.0' }
let wired = false

/**
 * electron-updater is loaded lazily and only in a packaged build.
 *
 * In development there is no app-update.yml for it to read, and importing it eagerly means every
 * `npm run dev` starts by throwing. Development reports 'unconfigured', which is the truth: a
 * checkout has no release to update to.
 */
function load(): Updater | null {
  if (!app.isPackaged) return null
  if (updater) return updater
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
  updater = autoUpdater
  return updater
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('spydir:updates:state', state)
  }
}

function set(next: Partial<UpdateCheck>): void {
  state = { ...state, ...next }
  broadcast()
}

function wire(auto: Updater, settings: AppSettings): void {
  if (wired) return
  wired = true

  // Never mid-session. The swap happens once the last window is gone.
  auto.autoInstallOnAppQuit = true
  auto.autoDownload = settings.updates.automatic
  if (settings.updates.feedUrl) auto.setFeedURL(settings.updates.feedUrl)

  auto.on('checking-for-update', () => set({ status: 'checking', error: undefined }))

  auto.on('update-available', (info) => {
    set({
      status: settings.updates.automatic ? 'downloading' : 'available',
      latest: info.version,
      publishedAt: info.releaseDate,
      notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
      progress: settings.updates.automatic ? 0 : undefined
    })
  })

  auto.on('update-not-available', (info) => set({ status: 'current', latest: info.version }))

  auto.on('download-progress', (progress) => {
    set({ status: 'downloading', progress: Math.round(progress.percent) })
  })

  auto.on('update-downloaded', (info) => set({ status: 'ready', latest: info.version, progress: 100 }))

  auto.on('error', (err) => {
    // A failed check is not something to interrupt anyone over: the app works, it simply does not
    // know whether it is current. The message is shown where it was asked for, and nowhere else.
    set({ status: 'error', error: err instanceof Error ? err.message : 'Could not check for updates.' })
  })
}

export function updateState(): UpdateCheck {
  return state
}

export async function checkForUpdate(settings: AppSettings, version: string): Promise<UpdateCheck> {
  state = { ...state, current: version }

  const auto = load()
  if (!auto) {
    set({
      status: 'unconfigured',
      error: app.isPackaged ? undefined : 'Updates are only available in an installed build.'
    })
    return state
  }

  wire(auto, settings)
  auto.autoDownload = settings.updates.automatic

  try {
    await auto.checkForUpdates()
  } catch (err) {
    set({ status: 'error', error: err instanceof Error ? err.message : 'Could not reach the update feed.' })
  }
  return state
}

/** Fetch the staged update after the person has said yes. */
export async function downloadUpdate(): Promise<UpdateCheck> {
  const auto = load()
  if (!auto) return state
  try {
    set({ status: 'downloading', progress: 0 })
    await auto.downloadUpdate()
  } catch (err) {
    set({ status: 'error', error: err instanceof Error ? err.message : 'The update could not be downloaded.' })
  }
  return state
}

/**
 * Apply now, by quitting and restarting.
 *
 * Only offered once an update is downloaded and waiting, so this closes the app rather than
 * leaving someone staring at a progress bar they cannot cancel.
 */
export function installUpdate(): void {
  const auto = load()
  if (!auto || state.status !== 'ready') return
  setImmediate(() => auto.quitAndInstall(false, true))
}
