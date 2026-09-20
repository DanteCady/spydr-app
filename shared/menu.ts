/**
 * The menu, defined once. The main process turns this into a native Electron menu (which also
 * supplies the keyboard accelerators) and the renderer draws the same model as an in-window bar on
 * the platforms that get custom chrome, so the two can never drift apart.
 */
export type MenuCommand =
  | 'file:sample'
  | 'file:connect'
  | 'file:restore'
  | 'file:disconnect'
  | 'file:export'
  | 'file:report'
  | 'file:remember'
  | 'file:forget'
  | 'edit:find'
  | 'view:directory'
  | 'view:web'
  | 'view:pathfinder'
  | 'view:hygiene'
  | 'view:timeline'
  | 'view:settings'
  | 'view:theme:dark'
  | 'view:theme:light'
  | 'view:theme:vivid'
  | 'view:theme:minimal'
  | 'view:theme:minimal-dark'
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
  | 'help:docs'
  | 'help:about'

/** Editing actions the OS performs for us; the renderer asks main to run them by name. */
export type MenuRole = 'undo' | 'redo' | 'cut' | 'copy' | 'paste' | 'selectAll'

export interface MenuEntry {
  label?: string
  command?: MenuCommand
  role?: MenuRole
  accelerator?: string
  separator?: true
  submenu?: MenuEntry[]
}

export interface MenuSection {
  label: string
  items: MenuEntry[]
}

export const MENU: MenuSection[] = [
  {
    label: 'File',
    items: [
      { label: 'Open Sample Directory', command: 'file:sample', accelerator: 'CmdOrCtrl+Shift+O' },
      { label: 'Connect to Active Directory…', command: 'file:connect', accelerator: 'CmdOrCtrl+O' },
      { label: 'Restore Last Session', command: 'file:restore', accelerator: 'CmdOrCtrl+Shift+R' },
      { label: 'Keep This Directory on This Computer', command: 'file:remember' },
      { label: 'Forget Saved Session', command: 'file:forget' },
      { separator: true },
      { label: 'Export Canvas as PNG…', command: 'file:export', accelerator: 'CmdOrCtrl+E' },
      { label: 'Generate Hygiene Report (PDF)…', command: 'file:report', accelerator: 'CmdOrCtrl+P' },
      { separator: true },
      { label: 'Disconnect', command: 'file:disconnect', accelerator: 'CmdOrCtrl+Shift+D' }
    ]
  },
  {
    label: 'Edit',
    items: [
      { label: 'Undo', role: 'undo', accelerator: 'CmdOrCtrl+Z' },
      { label: 'Redo', role: 'redo', accelerator: 'CmdOrCtrl+Shift+Z' },
      { separator: true },
      { label: 'Cut', role: 'cut', accelerator: 'CmdOrCtrl+X' },
      { label: 'Copy', role: 'copy', accelerator: 'CmdOrCtrl+C' },
      { label: 'Paste', role: 'paste', accelerator: 'CmdOrCtrl+V' },
      { label: 'Select All', role: 'selectAll', accelerator: 'CmdOrCtrl+A' },
      { separator: true },
      { label: 'Find in Directory', command: 'edit:find', accelerator: 'CmdOrCtrl+F' }
    ]
  },
  {
    label: 'View',
    items: [
      { label: 'Directory', command: 'view:directory', accelerator: 'CmdOrCtrl+1' },
      { label: 'Web', command: 'view:web', accelerator: 'CmdOrCtrl+2' },
      { label: 'Pathfinder', command: 'view:pathfinder', accelerator: 'CmdOrCtrl+3' },
      { label: 'Hygiene', command: 'view:hygiene', accelerator: 'CmdOrCtrl+4' },
      { label: 'Timeline', command: 'view:timeline', accelerator: 'CmdOrCtrl+5' },
      { separator: true },
      { label: 'Settings', command: 'view:settings', accelerator: 'CmdOrCtrl+,' },
      { separator: true },
      {
        label: 'Canvas',
        submenu: [
          { label: 'Tree', command: 'canvas:tree' },
          { label: 'Structure', command: 'canvas:structure' },
          { separator: true },
          { label: 'Toggle Grid', command: 'canvas:grid', accelerator: 'CmdOrCtrl+G' },
          { label: 'Toggle Legend', command: 'canvas:legend', accelerator: 'CmdOrCtrl+L' },
          { label: 'Toggle Names', command: 'canvas:labels' },
          { label: 'Toggle Trace', command: 'canvas:trace', accelerator: 'CmdOrCtrl+T' },
          { separator: true },
          { label: 'Zoom In', command: 'canvas:zoom-in', accelerator: 'CmdOrCtrl+Plus' },
          { label: 'Zoom Out', command: 'canvas:zoom-out', accelerator: 'CmdOrCtrl+-' },
          { label: 'Fit to View', command: 'canvas:fit', accelerator: 'CmdOrCtrl+0' },
          { label: 'Reset View', command: 'canvas:reset' }
        ]
      },
      {
        label: 'Theme',
        submenu: [
          { label: 'Dark', command: 'view:theme:dark' },
          { label: 'Light', command: 'view:theme:light' },
          { label: 'Vivid', command: 'view:theme:vivid' },
          { label: 'Minimal Light', command: 'view:theme:minimal' },
          { label: 'Minimal Dark', command: 'view:theme:minimal-dark' }
        ]
      }
    ]
  },
  {
    label: 'Help',
    items: [
      { label: 'SPYDIR Guide', command: 'help:docs', accelerator: 'CmdOrCtrl+/' },
      { label: 'About SPYDIR', command: 'help:about' }
    ]
  }
]
