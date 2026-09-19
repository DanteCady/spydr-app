import Link from 'next/link'
import { navigation } from '@/lib/docs'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const groups = navigation()
  return (
    <main className="docs">
      <nav className="docs-nav" aria-label="Documentation">
        {groups.map(({ section, items }) => (
          <div className="docs-group" key={section}>
            <h4 className="mono">{section}</h4>
            {items.map((item) => (
              <Link key={item.slug} href={`/docs/${item.slug}`}>
                {item.title}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="docs-body">{children}</div>
    </main>
  )
}
