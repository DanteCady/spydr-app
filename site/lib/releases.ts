/**
 * Download links.
 *
 * Once GITHUB_REPO is set, the build asks GitHub for the latest release and the cards describe
 * whatever is actually published — version, filenames, real byte sizes. Until then the constants
 * below stand in, and they are the sizes of the 0.1.0 build rather than invented ones.
 */

export interface Asset {
  os: 'macOS' | 'Windows' | 'Linux'
  file: string
  note: string
  /** Bytes, when known from the release. */
  size?: number
  url: string
}

export interface Release {
  version: string
  url: string
  assets: Asset[]
  /** True when this came from GitHub rather than the fallback below. */
  live: boolean
}

/** e.g. "dantecady/spydr". Unset means the site builds from the fallback. */
const REPO = process.env.GITHUB_REPO ?? ''

export const VERSION = '0.1.0'

const FALLBACK: Release = {
  version: VERSION,
  url: '#downloads',
  live: false,
  assets: [
    { os: 'macOS', file: `SPYDR-${VERSION}-arm64.dmg`, note: 'Apple silicon · 128 MB', url: '#downloads' },
    { os: 'macOS', file: `SPYDR-${VERSION}.dmg`, note: 'Intel · 128 MB', url: '#downloads' },
    { os: 'Windows', file: `SPYDR Setup ${VERSION}.exe`, note: 'x64 and arm64 · 225 MB', url: '#downloads' },
    { os: 'Linux', file: `SPYDR-${VERSION}.AppImage`, note: 'x64 · 129 MB · chmod +x', url: '#downloads' }
  ]
}

interface GhAsset {
  name: string
  size: number
  browser_download_url: string
}

function megabytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`
}

function describe(name: string, size: number): Pick<Asset, 'os' | 'note'> {
  const mb = megabytes(size)
  if (name.endsWith('.exe')) return { os: 'Windows', note: `x64 and arm64 · ${mb}` }
  if (name.endsWith('.AppImage')) return { os: 'Linux', note: `${/arm64/.test(name) ? 'arm64' : 'x64'} · ${mb} · chmod +x` }
  return { os: 'macOS', note: `${/arm64/.test(name) ? 'Apple silicon' : 'Intel'} · ${mb}` }
}

export async function latestRelease(): Promise<Release> {
  if (!REPO) return FALLBACK
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      // Rebuild the page hourly rather than on every request.
      next: { revalidate: 3600 }
    })
    if (!res.ok) return FALLBACK

    const body = (await res.json()) as { tag_name?: string; html_url?: string; assets?: GhAsset[] }
    const wanted = (body.assets ?? []).filter((a) => /\.(dmg|exe|AppImage)$/.test(a.name))
    if (wanted.length === 0) return FALLBACK

    return {
      version: (body.tag_name ?? VERSION).replace(/^v/, ''),
      url: body.html_url ?? FALLBACK.url,
      live: true,
      assets: wanted.map((a) => ({
        ...describe(a.name, a.size),
        file: a.name,
        size: a.size,
        url: a.browser_download_url
      }))
    }
  } catch {
    // A landing page must not fail to build because GitHub had a bad minute.
    return FALLBACK
  }
}
