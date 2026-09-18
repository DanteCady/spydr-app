import { app, BrowserWindow, Menu, shell, type MenuItemConstructorOptions } from 'electron'

/** Commands the menu sends to the renderer, which owns all of the application state. */
export type MenuCommand =
  | 'file:sample'
  | 'file:connect'
  | 'file:restore'
  | 'file:disconnect'
  | 'file:export'
  | 'edit:find'
  | 'view:directory'
  | 'view:web'
  | 'view:pathfinder'
  | 'view:hygiene'
  | 'view:theme:dark'
  | 'view:theme:light'
  | 'view:theme:vivid'
  | 'canvas:tree'
  | 'canvas:structure'
  | 'canvas:grid'
  | 'canvas:legend'
  | 'canvas:labels'
  | 'canvas:trace'
  | 'canvas:zoom-in'
  | 'canvas:zoom-out'
  | 'canvas:fit'
  | 'canvas:reset'

const DOCS = 'https://github.com/'

export function buildMenu(): void {
  const send = (command: MenuCommand) => () => {
    BrowserWindow.getFocusedWindow()?.webContents.send('spydr:menu', command)
  }
  const item = (label: string, command: MenuCommand, accelerator?: string): MenuItemConstructorOptions => ({
    label,
    accelerator,
    click: send(command)
  })

  const isMac = process.platform === 'darwin'
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
    {
      label: 'File',
      submenu: [
        item('Open Sample Directory', 'file:sample', 'CmdOrCtrl+Shift+O'),
        item('Connect to Active Directory…', 'file:connect', 'CmdOrCtrl+O'),
        item('Restore Last Session', 'file:restore', 'CmdOrCtrl+Shift+R'),
        { type: 'separator' },
        item('Export Canvas as PNG…', 'file:export', 'CmdOrCtrl+E'),
        { type: 'separator' },
        item('Disconnect', 'file:disconnect', 'CmdOrCtrl+Shift+D'),
        ...(isMac ? [] : ([{ type: 'separator' }, { role: 'quit' }] as MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        item('Find in Directory', 'edit:find', 'CmdOrCtrl+F')
      ]
    },
    {
      label: 'View',
      submenu: [
        item('Directory', 'view:directory', 'CmdOrCtrl+1'),
        item('Web', 'view:web', 'CmdOrCtrl+2'),
        item('Pathfinder', 'view:pathfinder', 'CmdOrCtrl+3'),
        item('Hygiene', 'view:hygiene', 'CmdOrCtrl+4'),
        { type: 'separator' },
        {
          label: 'Canvas',
          submenu: [
            item('Tree', 'canvas:tree'),
            item('Structure', 'canvas:structure'),
            { type: 'separator' },
            item('Toggle Grid', 'canvas:grid', 'CmdOrCtrl+G'),
            item('Toggle Legend', 'canvas:legend', 'CmdOrCtrl+L'),
            item('Toggle Names', 'canvas:labels'),
            item('Toggle Trace', 'canvas:trace', 'CmdOrCtrl+T'),
            { type: 'separator' },
            item('Zoom In', 'canvas:zoom-in', 'CmdOrCtrl+Plus'),
            item('Zoom Out', 'canvas:zoom-out', 'CmdOrCtrl+-'),
            item('Fit to View', 'canvas:fit', 'CmdOrCtrl+0'),
            item('Reset View', 'canvas:reset')
          ]
        },
        {
          label: 'Theme',
          submenu: [
            item('Dark', 'view:theme:dark'),
            item('Light', 'view:theme:light'),
            item('Vivid', 'view:theme:vivid')
          ]
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : ([{ role: 'reload' }, { role: 'toggleDevTools' }] as MenuItemConstructorOptions[]))
      ]
    },
    {
      label: 'Window',
      submenu: isMac
        ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }, { role: 'close' }]
        : [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Spydr Documentation',
          click: () => void shell.openExternal(DOCS)
        },
        {
          label: 'About Spydr',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('spydr:menu', 'help:about')
          }
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
