import { Search } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ARTICLES, SECTIONS, WHATS_NEW_ID } from '../help/articles'
import { useUnreadRelease } from '../lib/useUnreadRelease'
import { useApp } from '../state'

/** The visible text of an article, for the filter to match against. */
function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join(' ')
  if (typeof node === 'object' && 'props' in (node as { props?: unknown })) {
    return textOf((node as { props: { children?: ReactNode } }).props?.children)
  }
  return ''
}

export function Help() {
  const { helpTopic, snapshot } = useApp()
  const [current, setCurrent] = useState<string>(helpTopic ?? ARTICLES[0].id)
  const [query, setQuery] = useState('')

  const haystacks = useMemo(
    () => new Map(ARTICLES.map((a) => [a.id, `${a.title} ${a.blurb} ${a.keywords ?? ''} ${textOf(a.body)}`.toLowerCase()])),
    []
  )

  const q = query.trim().toLowerCase()
  const matches = q ? ARTICLES.filter((a) => haystacks.get(a.id)?.includes(q)) : ARTICLES
  const article = ARTICLES.find((a) => a.id === current) ?? ARTICLES[0]
  const showing = matches.some((a) => a.id === article.id) ? article : matches[0]

  // Read when read, not when the guide is opened — the dot should survive someone who came here
  // for something else entirely.
  const { markSeen } = useUnreadRelease()
  useEffect(() => {
    if (showing?.id === WHATS_NEW_ID) markSeen()
  }, [showing?.id, markSeen])

  return (
    <div className="kb">
      <nav className="kb-nav">
        <label className="kb-search">
          <Search size={13} aria-hidden />
          <input
            type="search"
            value={query}
            placeholder="Search the guide…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {SECTIONS.map((section) => {
          const inSection = matches.filter((a) => a.section === section)
          if (inSection.length === 0) return null
          return (
            <div className="kb-section" key={section}>
              <h4>{section}</h4>
              {inSection.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={showing?.id === a.id ? 'active' : ''}
                  onClick={() => setCurrent(a.id)}
                >
                  <strong>{a.title}</strong>
                  <em>{a.blurb}</em>
                </button>
              ))}
            </div>
          )
        })}
        {matches.length === 0 ? <p className="kb-empty">Nothing in the guide matches “{query}”.</p> : null}
      </nav>

      <article className="kb-body scroll">
        {showing ? (
          <>
            <p className="kb-crumb">{showing.section}</p>
            <h2>{showing.title}</h2>
            {showing.body}
          </>
        ) : null}
        {/* What is open, when something is. The read-only promise used to be repeated here on
            every article; it is a principle in About SPYDIR, and saying it thirty times over does
            not make it truer — it just trains people to stop reading the bottom of the page. */}
        {snapshot ? (
          <footer className="kb-foot">
            Reading {snapshot.domain} · {snapshot.stats.findings} findings
          </footer>
        ) : null}
      </article>
    </div>
  )
}
