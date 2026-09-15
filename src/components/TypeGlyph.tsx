import type { DirectoryObjectType } from '@shared/types'

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
