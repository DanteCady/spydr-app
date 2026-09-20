import { app, net } from 'electron'
import { isNewer } from '../shared/version'

/**
 * An update check, done by asking one URL the user configured. SPYDIR contacts nothing unless a feed
 * is set, and it never downloads or installs anything — it reports what is out there and links to
 * it. Shipping an auto-installer would need signed builds and a publish pipeline first.
 */
export interface UpdateCheck {
  status: 'unconfigured' | 'current' | 'available' | 'error'
  current: string
  latest?: string
  url?: string
  publishedAt?: string
  error?: string
}

/** The GitHub releases shape, which is also what a hand-rolled feed is easiest to imitate. */
interface Release {
  tag_name?: string
  name?: string
  html_url?: string
  published_at?: string
  draft?: boolean
  prerelease?: boolean
}

export async function checkForUpdate(feedUrl: string, version?: string): Promise<UpdateCheck> {
  const current = version ?? app.getVersion()
  if (!feedUrl) return { status: 'unconfigured', current }
  if (!/^https:\/\//i.test(feedUrl)) return { status: 'error', current, error: 'The update feed must be an https URL.' }

  try {
    // net.fetch goes through Chromium, so it follows the system proxy an enterprise will have set.
    const res = await net.fetch(feedUrl, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return { status: 'error', current, error: `Update feed answered ${res.status}.` }

    const body: unknown = await res.json()
    const releases: Release[] = Array.isArray(body) ? (body as Release[]) : [body as Release]
    const usable = releases.filter((r) => !r.draft && !r.prerelease)
    const latest = usable
      .map((r) => ({ release: r, tag: (r.tag_name || r.name || '').trim() }))
      .filter((r) => r.tag)
      .sort((a, b) => (isNewer(a.tag, b.tag) ? -1 : 1))[0]

    if (!latest) return { status: 'error', current, error: 'The update feed held no published release.' }
    if (!isNewer(latest.tag, current)) return { status: 'current', current, latest: latest.tag }
    return {
      status: 'available',
      current,
      latest: latest.tag,
      url: latest.release.html_url,
      publishedAt: latest.release.published_at
    }
  } catch (err) {
    return { status: 'error', current, error: err instanceof Error ? err.message : 'Could not reach the update feed.' }
  }
}
