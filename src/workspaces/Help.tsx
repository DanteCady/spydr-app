import { Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { ARTICLES } from '../help/articles'
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
        {matches.map((a) => (
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
        {matches.length === 0 ? <p className="kb-empty">Nothing in the guide matches “{query}”.</p> : null}
      </nav>

      <article className="kb-body scroll">
        {showing ? (
          <>
            <h2>{showing.title}</h2>
            {showing.body}
          </>
        ) : null}
        <footer className="kb-foot">
          {snapshot
            ? `Reading ${snapshot.domain} · ${snapshot.stats.findings} findings · SPYDR is read-only and never writes to Active Directory.`
            : 'SPYDR is read-only and never writes to Active Directory.'}
        </footer>
      </article>
    </div>
  )
}
