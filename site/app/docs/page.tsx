import Link from 'next/link'
import { navigation } from '@/lib/docs'

export const metadata = {
  title: 'Documentation',
  description: 'The SPYDR guide: getting started, every workspace, the hygiene rules, and the boundary of the tool.'
}

export default function DocsIndex() {
  const groups = navigation()
  return (
    <article className="doc">
      <p className="kb-crumb mono">Documentation</p>
      <h1>The SPYDR guide</h1>
      <p className="doc-lede">
        The same guide that ships inside the application, published here so you can read it before downloading
        anything. Start with <Link href="/docs/start">Getting started</Link>, or{' '}
        <Link href="/docs/playbook">Making the most of SPYDR</Link> if you already know what it does.
      </p>
      {groups.map(({ section, items }) => (
        <section className="doc-index" key={section}>
          <h2>{section}</h2>
          <ul>
            {items.map((item) => (
              <li key={item.slug}>
                <Link href={`/docs/${item.slug}`}>{item.title}</Link>
                <span>{item.blurb}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </article>
  )
}
