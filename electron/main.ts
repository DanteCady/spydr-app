import { app, BrowserWindow, ipcMain, nativeImage, session, shell } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { discoverDcs, windowsPrefill } from './directory/discoverDc'
import { ingestDirectory, testConnection } from './directory/ldapProvider'
import type { ConnectionInput } from '../shared/types'

app.setName('Spydr')

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

function createWindow(): void {
  const icon = appIcon()
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#101216',
    title: 'Spydr',
    show: false,
    ...(icon ? { icon } : {}),
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
  const icon = appIcon()
  if (icon) app.dock?.setIcon(icon)
  session.defaultSession.on('will-download', (_evt, item) => {
    item.setSavePath(join(app.getPath('downloads'), item.getFilename()))
  })
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
