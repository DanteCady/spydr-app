import type { NextConfig } from 'next'

/**
 * The docs are rendered from the desktop app's own guide components, which live outside this
 * directory — externalDir lets Next compile them in place rather than forcing a copy that would
 * immediately start drifting.
 */
const config: NextConfig = {
  experimental: { externalDir: true },
  images: { formats: ['image/avif', 'image/webp'] }
}

export default config
