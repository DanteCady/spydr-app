import { useMemo, useState } from 'react'
import type { DirectoryNode } from '@shared/types'
import { TypeGlyph } from './TypeGlyph'

export function ObjectPicker({
  nodes,
  value,
  onChange,
  placeholder
}: {
  nodes: DirectoryNode[]
  value: string
  onChange: (id: string) => void
  placeholder: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const selected = nodes.find((n) => n.id === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? nodes.filter((n) =>
          `${n.displayName} ${n.sAMAccountName} ${n.userPrincipalName ?? ''} ${n.type}`.toLowerCase().includes(q)
        )
      : nodes
    return list.slice(0, 40)
  }, [nodes, query])

  return (
    <div className="picker">
      <input
        value={open ? query : selected ? `${selected.displayName} (${selected.type})` : ''}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150)
        }}
      />
      {open ? (
        <ul className="picker-list">
          {filtered.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(n.id)
                  setOpen(false)
                  setQuery('')
                }}
              >
                <TypeGlyph type={n.type} />
                <span>{n.displayName}</span>
                <span className="muted">
                  {n.sAMAccountName}
                  {n.privileged ? ' · privileged' : ''}
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 ? <li className="empty">No matches</li> : null}
        </ul>
      ) : null}
    </div>
  )
}
