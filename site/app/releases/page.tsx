import Link from 'next/link'
import { formatReleaseDate, groupByCategory, highlightLabel } from '@shared/releases'
import { RELEASES } from '@/lib/releaseNotes'

export const metadata = {
  title: 'Releases',
  description: 'Every version of SPYDR and what changed in it.'
}

/**
 * The whole history on one page.
 *
 * Read before downloading, so it has to stand on its own: each entry says what changed in words a
 * person can act on, rather than linking away to a commit range.
 */
export default function Releases() {
  return (
    <article className="doc">
      <p className="kb-crumb mono">Releases</p>
      <h1>What has changed</h1>
      <p className="doc-lede">
        Every version of SPYDR, newest first. The same notes are in the application under{' '}
        <strong>Guide &rsaquo; What&rsquo;s new</strong>, so you can read them before or after updating.
      </p>

      {RELEASES.map((release) => (
        <section className="rel-entry" key={release.version} id={release.version}>
          <header className="rel-head">
            <Link className="rel-version mono" href={`/releases/${release.version}`}>
              v{release.version}
            </Link>
            <span className="rel-date">{formatReleaseDate(release.date)}</span>
          </header>
          <h2>{release.title}</h2>
          <p className="rel-summary">{release.summary}</p>

          {groupByCategory(release.highlights).map((group) => (
            <div className="rel-group" key={group.category}>
              <h3>{group.category}</h3>
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
        </section>
      ))}
    </article>
  )
}
