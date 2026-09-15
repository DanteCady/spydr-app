import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { discoverDcs, windowsPrefill } from './directory/discoverDc'
import { ingestDirectory, testConnection } from './directory/ldapProvider'
import type { ConnectionInput } from '../shared/types'

function preloadPath(): string {
  const mjs = join(__dirname, '../preload/preload.mjs')
  const js = join(__dirname, '../preload/preload.js')
  return existsSync(mjs) ? mjs : js
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#101216',
    title: 'Spydr',
    show: false,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

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
  ipcMain.handle('spydr:ingest', async (_evt, input: ConnectionInput) => ingestDirectory(input))
}

void app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
