import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('spydr', {
  uiOnly: true
})
