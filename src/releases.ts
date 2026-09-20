import { parseRelease, sortReleases, type Release } from '@shared/releases'

/**
 * The release notes, as the app sees them.
 *
 * Vite reads every file in content/releases at build time, so adding a version is adding a file —
 * there is no list to remember to update, and therefore no list that can be forgotten. The site
 * reads the same directory from disk and arrives at the same answer.
 */
const files = import.meta.glob('../content/releases/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

export const RELEASES: Release[] = sortReleases(
  Object.entries(files).map(([path, raw]) => parseRelease(raw, path.split('/').pop() ?? path))
)

export const LATEST_RELEASE: Release | undefined = RELEASES[0]
