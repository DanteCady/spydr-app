import type { AboutInfo } from '@shared/settings'

/**
 * The guide components are written for the desktop app, where a preload bridge exists. On the
 * website it never does, and each of them already handles its absence — this declaration exists so
 * the compiler knows the shape they probe for.
 */
declare global {
  interface Window {
    spydir?: {
      about: () => Promise<AboutInfo>
      chrome?: () => { custom: boolean; platform: string; titleBarHeight: number }
    }
  }
}

export {}
