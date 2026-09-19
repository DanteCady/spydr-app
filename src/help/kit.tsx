import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { AboutInfo } from '@shared/settings'

/** Shared pieces for the knowledge base articles. */

export type Section = 'Start here' | 'Workspaces' | 'Concepts' | 'Operating'

export interface Article {
  id: string
  section: Section
  title: string
  blurb: string
  /** Extra words the filter should match, beyond the visible text. */
  keywords?: string
  body: ReactNode
}

export function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="kb-term">
      <dt>{name}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** A control as it is labelled in the interface, with what it does. */
export function Control({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="kb-term kb-control">
      <dt>{name}</dt>
      <dd>{children}</dd>
    </div>
  )
}

export function BuildInfo() {
  const [about, setAbout] = useState<AboutInfo | null>(null)
  useEffect(() => {
    void window.spydr?.about().then(setAbout)
  }, [])
  if (!about) return <p className="muted">Build information is only available in the desktop app.</p>
  return (
    <table className="kb-keys">
      <tbody>
        <tr>
          <td className="muted">Version</td>
          <td>
            {about.version}
            {about.packaged ? '' : ' (development build)'}
          </td>
        </tr>
        <tr>
          <td className="muted">Electron</td>
          <td>{about.electron}</td>
        </tr>
        <tr>
          <td className="muted">Chromium</td>
          <td>{about.chrome}</td>
        </tr>
        <tr>
          <td className="muted">Node</td>
          <td>{about.node}</td>
        </tr>
        <tr>
          <td className="muted">Platform</td>
          <td>{about.platform}</td>
        </tr>
        <tr>
          <td className="muted">Data folder</td>
          <td>
            <code>{about.userData}</code>
          </td>
        </tr>
      </tbody>
    </table>
  )
}
