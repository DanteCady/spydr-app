import type { NextConfig } from 'next'

/**
 * The docs are rendered from the desktop app's own guide components, which live outside this
 * directory — externalDir lets Next compile them in place rather than forcing a copy that would
 * immediately start drifting.
 */
/**
 * Set here rather than only at nginx, so they travel with the app and survive a proxy being
 * rebuilt by someone who never saw this file. nginx may set them again; duplicates are harmless.
 */
const SECURITY_HEADERS = [
  // The site is static marketing plus docs. It loads its own assets and Google's fonts, and posts
  // to its own API — nothing else, so everything else is refused.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'"
    ].join('; ')
  },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' }
]

const config: NextConfig = {
  experimental: { externalDir: true },
  images: { formats: ['image/avif', 'image/webp'] },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  }
}

export default config
