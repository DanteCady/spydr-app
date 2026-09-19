import { app, BrowserWindow } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { applyPatch, DEFAULT_SETTINGS, normalizeSettings, type AppSettings, type SettingsPatch } from '../shared/settings'

/**
 * The settings file, read once at startup and held in memory. Main is the owner: the ingest and the
 * report writer read it directly, and the renderer gets a copy over IPC. Writes are atomic, and a
 * corrupt or hand-edited file falls back to defaults rather than stopping the app.
 */

let cache: AppSettings | null = null

function file(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

export function getSettings(): AppSettings {
  if (cache) return cache
  try {
    cache = existsSync(file()) ? normalizeSettings(JSON.parse(readFileSync(file(), 'utf8'))) : { ...DEFAULT_SETTINGS }
  } catch {
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

function write(next: AppSettings): void {
  cache = next
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8')
  renameSync(tmp, file())
}

/** Applies a patch and tells every window, so two windows never disagree. */
export function updateSettings(patch: SettingsPatch): AppSettings {
  const next = applyPatch(getSettings(), patch)
  write(next)
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('spydr:settings', next)
  return next
}

export function resetSettings(): AppSettings {
  write({ ...DEFAULT_SETTINGS })
  for (const win of BrowserWindow.getAllWindows()) win.webContents.send('spydr:settings', cache)
  return getSettings()
}

/** Where the settings file lives, for the About section to show. */
export function settingsPath(): string {
  return file()
}
