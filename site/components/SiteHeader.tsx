import Link from 'next/link'
import { WidowMark } from './WidowMark'
import { VERSION } from '@/lib/releases'

export function SiteHeader() {
  return (
    <header className="nav">
      <Link className="mark" href="/">
        <WidowMark />
        <span>
          SPY<em>DR</em>
        </span>
      </Link>
      <nav>
        <Link href="/#problem">The problem</Link>
        <Link href="/#inside">Inside</Link>
        <Link href="/#limits">Limits</Link>
        <Link href="/docs">Docs</Link>
      </nav>
      <Link className="btn small" href="/#downloads">
        Get SPYDR <span className="ver">{VERSION}</span>
      </Link>
    </header>
  )
}
