import type { MetadataRoute } from 'next'
import { slugs } from '@/lib/docs'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://spydir.io'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    { url: SITE_URL, lastModified: now, priority: 1 },
    { url: `${SITE_URL}/docs`, lastModified: now, priority: 0.8 },
    ...slugs().map((slug) => ({ url: `${SITE_URL}/docs/${slug}`, lastModified: now, priority: 0.6 }))
  ]
}
