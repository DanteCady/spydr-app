import type { DirectoryObjectType } from '@shared/types'

const BODY: Record<DirectoryObjectType, string> = {
  user: '<circle cx="16" cy="10.4" r="5.1"/><path d="M6.2 27.2c1.1-7.2 4.4-10.4 9.8-10.4s8.7 3.2 9.8 10.4z"/>',
  group:
    '<circle cx="11.2" cy="10.2" r="4.4"/><circle cx="20.8" cy="10.2" r="4.4"/><path d="M4.4 27.2c.9-6.4 3.2-9.2 6.9-9.2 1.9 0 3.5.8 4.7 2.1 1.2-1.3 2.8-2.1 4.7-2.1 3.7 0 6 2.8 6.9 9.2z"/>',
  computer:
    '<rect x="5.2" y="6.2" width="21.6" height="14.2" rx="2"/><path d="M12 24.8h8M16 20.4v4.4"/>',
  ou: '<path d="M6 8.2h9.4l2.4 2.6H26v13.2H6z"/>',
  container: '<path d="M6 8.2h9.4l2.4 2.6H26v13.2H6z"/>'
}

export function webNodeIcon(type: DirectoryObjectType, fill = '#f4f7fb'): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 32 32"><g fill="${fill}">${BODY[type]}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function TypeGlyph({ type }: { type: DirectoryObjectType }) {
  const cls = `glyph glyph-${type}`
  switch (type) {
    case 'user':
      return (
        <span className={cls} aria-hidden>
          <svg viewBox="0 0 16 16">
            <circle cx="8" cy="5" r="2.4" />
            <path d="M3.5 13.2c.7-2.6 2.3-3.8 4.5-3.8s3.8 1.2 4.5 3.8" />
          </svg>
        </span>
      )
    case 'group':
      return (
        <span className={cls} aria-hidden>
          <svg viewBox="0 0 16 16">
            <circle cx="6" cy="5.2" r="2" />
            <circle cx="10.4" cy="5.2" r="2" />
            <path d="M2.6 13c.5-2.2 1.8-3.2 3.5-3.2 1 0 1.8.4 2.4 1.1.6-.7 1.4-1.1 2.4-1.1 1.7 0 3 1 3.5 3.2" />
          </svg>
        </span>
      )
    case 'computer':
      return (
        <span className={cls} aria-hidden>
          <svg viewBox="0 0 16 16">
            <rect x="2.5" y="3" width="11" height="7.5" rx="1" />
            <path d="M6 12.8h4M8 10.5v2.3" />
          </svg>
        </span>
      )
    default:
      return (
        <span className={cls} aria-hidden>
          <svg viewBox="0 0 16 16">
            <path d="M3 4.5h5.2l1.3 1.5H13v6.5H3z" />
          </svg>
        </span>
      )
  }
}
