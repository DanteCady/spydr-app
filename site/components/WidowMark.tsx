import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The application's own mark, read from its source so the site and the app can never show two
 * different spiders. Defined once per page and referenced by <use>.
 */
function widowPath(): string {
  const source = readFileSync(join(process.cwd(), '..', 'src', 'components', 'WidowMark.tsx'), 'utf8')
  const match = /d="([^"]+)"/.exec(source)
  if (!match) throw new Error('The widow mark path could not be read from the application source.')
  return match[1]
}

export function WidowSprite() {
  return (
    <svg width={0} height={0} aria-hidden style={{ position: 'absolute' }}>
      <symbol id="widow" viewBox="0 0 1114 1280">
        <g transform="translate(0 1280) scale(0.1 -0.1)" fill="currentColor">
          <path d={widowPath()} />
        </g>
      </symbol>
    </svg>
  )
}

export function WidowMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1114 1280" aria-hidden className={className}>
      <use href="#widow" />
    </svg>
  )
}
