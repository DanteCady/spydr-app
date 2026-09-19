import { app, BrowserWindow } from 'electron'
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { buildReport, reportFileName } from '../../shared/report/model'
import { DEFAULT_SETTINGS, type ReportSettings } from '../../shared/settings'
import type { DirectorySnapshot } from '../../shared/types'
import { renderReportHtml } from './html'

export { reportFileName }

const FONTS: { file: string; weight: number }[] = [
  { file: 'plex-400.woff2', weight: 400 },
  { file: 'plex-600.woff2', weight: 600 },
  { file: 'plex-700.woff2', weight: 700 }
]

/** Packaged builds ship the fonts as an extra resource; dev reads them from the repo. */
function fontDir(): string | null {
  const candidates = [
    join(process.resourcesPath ?? '', 'report-fonts'),
    join(__dirname, '../../resources/report-fonts'),
    join(app.getAppPath(), 'resources/report-fonts'),
    join(process.cwd(), 'resources/report-fonts')
  ]
  return candidates.find((dir) => existsSync(join(dir, FONTS[0].file))) ?? null
}

/**
 * The typeface travels inside the document as base64. The PDF must render identically on a machine
 * that has never seen IBM Plex, and the print window has no access to the app's stylesheets.
 */
function fontCss(): string {
  const dir = fontDir()
  if (!dir) return ''
  return FONTS.map(({ file, weight }) => {
    const data = readFileSync(join(dir, file)).toString('base64')
    return `@font-face {
  font-family: 'Plex Report';
  font-style: normal;
  font-weight: ${weight};
  src: url(data:font/woff2;base64,${data}) format('woff2');
}`
  }).join('\n')
}

export interface ReportResult {
  path: string
  pages: number
  findings: number
}

/**
 * Renders the report in an offscreen window and prints it to PDF. The window is isolated and loads
 * nothing but the document we just wrote: no preload, no node, no network.
 */
export async function writeReportPdf(
  snapshot: DirectorySnapshot,
  filePath: string,
  settings: ReportSettings = DEFAULT_SETTINGS.report
): Promise<ReportResult> {
  const report = buildReport(snapshot, {
    perSection: settings.perSection,
    priority: settings.prioritySection
  })
  const html = renderReportHtml(report, fontCss(), settings.paper)
  const tmp = join(app.getPath('temp'), `spydr-report-${randomUUID()}.html`)
  await writeFile(tmp, html, 'utf8')

  const win = new BrowserWindow({
    show: false,
    width: 816,
    height: 1056,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, javascript: true }
  })

  try {
    await win.loadFile(tmp)
    // Lay out only once the embedded faces are usable — measuring against a fallback font would
    // paginate to the wrong heights and strand content at the page break.
    const pages = (await win.webContents.executeJavaScript(
      'document.fonts.ready.then(() => window.__layout())'
    )) as number
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: settings.paper,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    })
    await writeFile(filePath, pdf)
    return { path: filePath, pages, findings: snapshot.findings.length }
  } finally {
    win.destroy()
    await unlink(tmp).catch(() => undefined)
  }
}
