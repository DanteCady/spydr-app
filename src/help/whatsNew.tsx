import { formatReleaseDate, groupByCategory, highlightLabel } from '@shared/releases'
import { RELEASES } from '../releases'
import type { Article } from './kit'

/**
 * What changed, read from the same Markdown the site publishes.
 *
 * It lives in the guide rather than behind its own button because that is where someone already
 * goes to find out how SPYDR works, and "what changed" is the same question with a timestamp on it.
 */
export const WHATS_NEW: Article[] = [
  {
    id: 'whats-new',
    section: 'Start here',
    title: "What's new",
    blurb: 'Every release, what changed in it, and when.',
    keywords: 'release notes changelog version history updates new improved fixed changes',
    body: (
      <>
        <p>
          Every version of SPYDR and what changed in it. The same notes are published at{' '}
          <span className="mono-hint">getspydr.com/releases</span>, so you can read them before deciding to update.
        </p>

        {RELEASES.map((release) => (
          <section key={release.version} className="rel-entry">
            <header className="rel-head">
              <span className="rel-version mono">v{release.version}</span>
              <span className="muted">{formatReleaseDate(release.date)}</span>
            </header>
            <h3>{release.title}</h3>
            <p className="rel-summary">{release.summary}</p>

            {groupByCategory(release.highlights).map((group) => (
              <div key={group.category} className="rel-group">
                <h4>{group.category}</h4>
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
      </>
    )
  }
]
