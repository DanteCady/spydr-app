import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatReleaseDate, groupByCategory, highlightLabel } from '@shared/releases'
import { RELEASES, releaseByVersion, releaseVersions } from '@/lib/releaseNotes'

/** One page per version, so a release can be linked to on its own. */
export function generateStaticParams() {
  return releaseVersions().map((version) => ({ version }))
}

export async function generateMetadata({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params
  const release = releaseByVersion(version)
  if (!release) return { title: 'Release not found' }
  return {
    title: `SPYDR ${release.version} — ${release.title}`,
    description: release.summary
  }
}

export default async function ReleasePage({ params }: { params: Promise<{ version: string }> }) {
  const { version } = await params
  const release = releaseByVersion(version)
  if (!release) notFound()

  const index = RELEASES.findIndex((r) => r.version === release.version)
  const newer = RELEASES[index - 1]
  const older = RELEASES[index + 1]

  return (
    <article className="doc">
      <p className="kb-crumb mono">
        <Link href="/releases">Releases</Link> · v{release.version}
      </p>
      <h1>{release.title}</h1>
      <p className="rel-date">
        Version {release.version} · {formatReleaseDate(release.date)}
      </p>
      <p className="doc-lede">{release.summary}</p>

      {groupByCategory(release.highlights).map((group) => (
        <div className="rel-group" key={group.category}>
          <h2>{group.category}</h2>
          <ul className="rel-list">
            {group.items.map((item) => (
              <li key={item.text}>
                <span className={`rel-tag rel-${item.type}`}>{highlightLabel(item.type)}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <nav className="rel-nav">
        {older ? (
          <Link href={`/releases/${older.version}`}>&larr; v{older.version}</Link>
        ) : (
          <span />
        )}
        {newer ? <Link href={`/releases/${newer.version}`}>v{newer.version} &rarr;</Link> : <span />}
      </nav>
    </article>
  )
}
