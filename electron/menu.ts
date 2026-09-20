import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import { MENU, type MenuEntry } from '../shared/menu'

/**
 * macOS keeps its menu in the system bar, as every Mac application does and as VS Code does.
 * Windows and Linux get custom chrome, where the native menu still exists — it is what supplies
 * the keyboard accelerators — but stays hidden behind the bar the renderer draws.
 */
export const usesCustomTitleBar = (): boolean =>
  process.platform !== 'darwin' || process.env.SPYDIR_CUSTOM_TITLEBAR === '1'

function send(command: string) {
  return (): void => {
    BrowserWindow.getFocusedWindow()?.webContents.send('spydir:menu', command)
  }
}

function toElectron(entry: MenuEntry): MenuItemConstructorOptions {
  if (entry.separator) return { type: 'separator' }
  if (entry.submenu) return { label: entry.label, submenu: entry.submenu.map(toElectron) }
  if (entry.role) return { label: entry.label, role: entry.role, accelerator: entry.accelerator }
  return { label: entry.label, accelerator: entry.accelerator, click: send(entry.command ?? '') }
}

export function buildMenu(): void {
  const isMac = process.platform === 'darwin'
  const sections = MENU.map((section) => ({ label: section.label, submenu: section.items.map(toElectron) }))
  const help = sections.pop() as MenuItemConstructorOptions

  const template: MenuItemConstructorOptions[] = [
    ...(isMac
      ? ([
          {
            label: app.name,
            submenu: [
              { role: 'about' },
              { type: 'separator' },
              { role: 'hide' },
              { role: 'hideOthers' },
              { role: 'unhide' },
              { type: 'separator' },
              { role: 'quit' }
            ]
          }
        ] as MenuItemConstructorOptions[])
      : []),
    ...sections,
    {
      label: 'Window',
      submenu: isMac
        ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }, { role: 'close' }]
        : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }]
    },
    { ...help, role: 'help' }
  ]

  // Quit has no home on Windows and Linux without an application menu, so File carries it.
  if (!isMac) {
    const file = template.find((s) => s.label === 'File')
    if (file && Array.isArray(file.submenu)) file.submenu.push({ type: 'separator' }, { role: 'quit' })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
