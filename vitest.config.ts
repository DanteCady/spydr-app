import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

// The renderer's @shared alias, so tests can import files under src/ that use it.
export default defineConfig({
  resolve: {
    alias: { '@shared': resolve(__dirname, 'shared') }
  }
})
