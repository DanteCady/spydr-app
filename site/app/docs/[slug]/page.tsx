import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DocBody } from '@/components/DocBody'
import { articleMeta, neighbours, slugs } from '@/lib/docs'

export function generateStaticParams() {
  return slugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const meta = articleMeta(slug)
  if (!meta) return {}
  return { title: meta.title, description: meta.blurb }
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const meta = articleMeta(slug)
  if (!meta) notFound()
  const { previous, next } = neighbours(slug)

  return (
    <article className="doc">
      <h1>{meta.title}</h1>
      <p className="doc-lede">{meta.blurb}</p>
      <DocBody slug={slug} />
      <nav className="doc-next">
        {previous ? (
          <Link href={`/docs/${previous.slug}`}>
            <span className="mono">Previous</span>
            {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/docs/${next.slug}`} className="right">
            <span className="mono">Next</span>
            {next.title}
          </Link>
        ) : null}
      </nav>
    </article>
  )
}
