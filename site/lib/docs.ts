import { ARTICLES, SECTIONS } from '../../src/help/articles'
import type { Article, Section } from '../../src/help/kit'

/**
 * The documentation is the desktop app's own guide — the same components, imported rather than
 * copied, so the help inside SPYDIR and the docs on this site cannot drift apart.
 */
export type { Article, Section }
export { ARTICLES, SECTIONS }

export interface NavItem {
  slug: string
  title: string
  blurb: string
}

export function navigation(): { section: Section; items: NavItem[] }[] {
  return SECTIONS.map((section) => ({
    section,
    items: ARTICLES.filter((a) => a.section === section).map(({ id, title, blurb }) => ({
      slug: id,
      title,
      blurb
    }))
  })).filter((group) => group.items.length > 0)
}

export function articleMeta(slug: string): NavItem | undefined {
  const found = ARTICLES.find((a) => a.id === slug)
  return found ? { slug: found.id, title: found.title, blurb: found.blurb } : undefined
}

export function slugs(): string[] {
  return ARTICLES.map((a) => a.id)
}

/** The article before and after this one, in reading order. */
export function neighbours(slug: string): { previous?: NavItem; next?: NavItem } {
  const flat = ARTICLES.map((a) => ({ slug: a.id, title: a.title, blurb: a.blurb }))
  const i = flat.findIndex((a) => a.slug === slug)
  return { previous: i > 0 ? flat[i - 1] : undefined, next: i >= 0 && i < flat.length - 1 ? flat[i + 1] : undefined }
}
