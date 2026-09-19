import { BASICS } from './basics'
import { CONCEPTS } from './concepts'
import { WORKSPACES } from './workspaces'
import type { Article, Section } from './kit'

export type { Article, Section }

/** The order sections appear in the guide. */
export const SECTIONS: Section[] = ['Start here', 'Workspaces', 'Concepts', 'Operating']

export const ARTICLES: Article[] = [...BASICS, ...WORKSPACES, ...CONCEPTS].sort(
  (a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section)
)
