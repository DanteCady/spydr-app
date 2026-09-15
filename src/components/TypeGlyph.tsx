import type { DirectoryObjectType } from '@shared/types'

// Lucide-style line icons (24×24, 2px round stroke) — sharp and modern at any size.
const ICON: Record<DirectoryObjectType, string> = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/>',
  group:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3 19v-.8A3.5 3.5 0 0 1 6.5 14.7h5A3.5 3.5 0 0 1 15 18.2V19"/><path d="M16.2 5a3.2 3.2 0 0 1 0 6.1"/><path d="M18.5 14.9a3.5 3.5 0 0 1 2.5 3.3V19"/>',
  computer: '<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20h7M12 16.5V20"/>',
  ou: '<path d="M4 19.5a1.8 1.8 0 0 1-1.8-1.8V6.3A1.8 1.8 0 0 1 4 4.5h4.7l2 2.4H20a1.8 1.8 0 0 1 1.8 1.8v9A1.8 1.8 0 0 1 20 19.5Z"/>',
  container: '<path d="M12 2.6 3.4 7.4v9.2L12 21.4l8.6-4.8V7.4Z"/><path d="m3.6 7.6 8.4 4.7 8.4-4.7"/><path d="M12 21.6V12.3"/>'
}

/** Graph node icon as a data URI. `color` strokes the glyph (white on a tinted disc by default). */
export function webNodeIcon(type: DirectoryObjectType, color = '#f6f8fb'): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" ` +
    `stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[type]}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function TypeGlyph({ type }: { type: DirectoryObjectType }) {
  return (
    <span className={`glyph glyph-${type}`} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICON[type] }} />
    </span>
  )
}
