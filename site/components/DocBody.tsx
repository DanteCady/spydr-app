'use client'

import { ARTICLES } from '../../src/help/articles'

/**
 * Renders one guide article. It runs on the client because a couple of the articles use hooks —
 * the About page asks the desktop app for its build information, and on the web it correctly
 * reports that there is no desktop app to ask.
 */
export function DocBody({ slug }: { slug: string }) {
  const article = ARTICLES.find((a) => a.id === slug)
  if (!article) return null
  return <>{article.body}</>
}
