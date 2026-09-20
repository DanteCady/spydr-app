import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseRelease, sortReleases, type Release } from '@shared/releases'

/**
 * The release notes, as the site sees them.
 *
 * Read straight off disk at build time from the same `content/releases` the app compiles in, so
 * the published page and the guide inside the app cannot describe different versions. A new file
 * is a new release on both, with nothing to register in either place.
 */
const DIR = join(process.cwd(), '..', 'content', 'releases')

function load(): Release[] {
  return sortReleases(
    readdirSync(DIR)
      .filter((f) => f.endsWith('.md'))
      .map((file) => parseRelease(readFileSync(join(DIR, file), 'utf8'), file))
  )
}

export const RELEASES: Release[] = load()

export function releaseVersions(): string[] {
  return RELEASES.map((r) => r.version)
}

export function releaseByVersion(version: string): Release | undefined {
  return RELEASES.find((r) => r.version === version)
}

/** The version the site should describe as current, which is whatever it last published notes for. */
export const CURRENT_VERSION: string = RELEASES[0]?.version ?? '0.0.0'
