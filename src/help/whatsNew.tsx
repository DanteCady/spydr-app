import { ChevronRight } from 'lucide-react'
import { formatReleaseDate, groupByCategory, highlightLabel } from '@shared/releases'
import { RELEASES } from '../releases'
import type { Article } from './kit'

/**
 * What changed, read from the same Markdown the site publishes.
 *
 * It lives in the guide rather than behind its own button because that is where someone already
 * goes to find out how SPYDR works, and "what changed" is the same question with a timestamp on it.
 *
 * Each version collapses. Once there are a dozen of them the page is otherwise a wall, and the
 * thing people come here for — what changed *most recently* — is the part they have to scroll
 * past everything else to leave. The newest is open; the rest are a title and a date until asked.
 * <details> rather than state, so it works without JavaScript bookkeeping and keyboard and screen
 * reader behaviour come for free.
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
          <span className="mono-hint">spydir.io/releases</span>, so you can read them before deciding to update.
        </p>

        {RELEASES.map((release, index) => (
          <details key={release.version} className="rel-entry" open={index === 0}>
            <summary className="rel-head">
              <ChevronRight className="rel-chevron" size={14} aria-hidden />
              <span className="rel-version mono">v{release.version}</span>
              <span className="rel-title">{release.title}</span>
              <span className="muted rel-when">{formatReleaseDate(release.date)}</span>
            </summary>

            <div className="rel-detail">
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
            </div>
          </details>
        ))}
      </>
    )
  }
]
