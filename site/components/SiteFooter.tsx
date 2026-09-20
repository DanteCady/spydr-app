import Link from 'next/link'
import { WidowMark } from './WidowMark'

export function SiteFooter() {
  return (
    <footer>
      <div className="foot-mark">
        <WidowMark />
        <span>
          SPY<em>DR</em>
        </span>
      </div>
      <nav className="foot-links">
        <Link href="/docs">Documentation</Link>
        <Link href="/releases">Releases</Link>
        <Link href="/#downloads">Download</Link>
      </nav>
      <p className="mono">Read-only directory tooling. Nothing leaves your machine.</p>
    </footer>
  )
}
