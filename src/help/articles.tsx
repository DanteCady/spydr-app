import { BASICS } from './basics'
import { CONCEPTS } from './concepts'
import { CONTACT } from './contact'
import { PLAYBOOK } from './playbook'
import { WHATS_NEW } from './whatsNew'
import { WORKSPACES } from './workspaces'
import type { Article, Section } from './kit'

export type { Article, Section }

/** The order sections appear in the guide. */
export const SECTIONS: Section[] = ['Start here', 'Workspaces', 'Concepts', 'Operating']

export const ARTICLES: Article[] = [...BASICS, ...WHATS_NEW, ...PLAYBOOK, ...WORKSPACES, ...CONCEPTS, ...CONTACT].sort(
  (a, b) => SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section)
)

/** The guide entry release notes open into, for the unread dot and the menu to point at. */
export const WHATS_NEW_ID = 'whats-new'
