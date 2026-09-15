import { useEffect, useRef, useState } from 'react'

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    []
  )

  return (
    <button
      type="button"
      className={copied ? 'copy-btn copied' : 'copy-btn'}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          if (timer.current !== null) window.clearTimeout(timer.current)
          timer.current = window.setTimeout(() => setCopied(false), 1200)
        })
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}
