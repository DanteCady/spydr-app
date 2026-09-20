import { app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * app.getVersion() answers with Electron's own version when it cannot find our package.json, which
 * happens whenever main is launched by file path rather than by project directory. Reading it
 * directly in development keeps the About screen, the licence check and any usage report from
 * reporting the runtime as the product.
 */
export function appVersion(): string {
  if (app.isPackaged) return app.getVersion()
  for (const dir of [app.getAppPath(), process.cwd(), join(__dirname, '../..')]) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: string; version?: string }
      if (pkg.name === 'spydir' && pkg.version) return pkg.version
    } catch {
      /* try the next candidate */
    }
  }
  return app.getVersion()
}
