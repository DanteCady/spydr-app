import Link from 'next/link'
import { formatReleaseDate } from '@shared/releases'
import { RELEASES } from '@/lib/releaseNotes'

/** The same shell as the docs, with versions down the side instead of articles. */
export default function ReleasesLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="docs">
      <nav className="docs-nav" aria-label="Releases">
        <div className="docs-group">
          <h4 className="mono">Versions</h4>
          <Link href="/releases">All releases</Link>
          {RELEASES.map((release) => (
            <Link key={release.version} href={`/releases/${release.version}`}>
              v{release.version}
              <span className="rel-nav-date">{formatReleaseDate(release.date)}</span>
            </Link>
          ))}
        </div>
      </nav>
      <div className="docs-body">{children}</div>
    </main>
  )
}
