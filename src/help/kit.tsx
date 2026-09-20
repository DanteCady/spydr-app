'use client'

import { Mail } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { feedbackMailto, securityMailto, supportMailto, FEEDBACK_EMAIL, SECURITY_EMAIL, SUPPORT_EMAIL } from '@shared/contact'
import type { AboutInfo } from '@shared/settings'
import { prettyAccelerator } from '../lib/accelerator'

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

/**
 * An accelerator written the way this platform writes it. The first render matches whatever the
 * server produced — the website publishes these same articles — and the platform-correct form
 * appears once mounted, so there is no hydration mismatch.
 */
export function Keys({ accelerator }: { accelerator: string }) {
  const [text, setText] = useState(() => prettyAccelerator(accelerator, 'other'))
  useEffect(() => {
    setText(prettyAccelerator(accelerator))
  }, [accelerator])
  return <kbd>{text}</kbd>
}

export function BuildInfo() {
  const [about, setAbout] = useState<AboutInfo | null>(null)
  useEffect(() => {
    void window.spydir?.about().then(setAbout)
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

/**
 * A mail link with the version and platform already in the message.
 *
 * Every support thread otherwise opens with a round trip asking which build this is, and the
 * person least able to answer that quickly is the one having the problem. The body also arrives
 * with the questions already in it, so a first message tends to answer them.
 */
export function MailButton({ to = 'support' }: { to?: 'support' | 'feedback' | 'security' }) {
  const [about, setAbout] = useState<AboutInfo | null>(null)
  useEffect(() => {
    void window.spydir?.about().then(setAbout)
  }, [])

  const build = {
    version: about?.version,
    platform: about ? `${about.platform} · Electron ${about.electron}` : undefined
  }
  const { href, label } =
    to === 'feedback'
      ? { href: feedbackMailto(build), label: FEEDBACK_EMAIL }
      : to === 'security'
        ? { href: securityMailto(build), label: SECURITY_EMAIL }
        : { href: supportMailto(build), label: SUPPORT_EMAIL }

  return (
    <p>
      <a className="btn-inline" href={href}>
        <Mail size={13} aria-hidden /> Email {label}
      </a>
      {about ? (
        <span className="muted kb-aside">Opens your mail app with version {about.version} already filled in.</span>
      ) : null}
    </p>
  )
}
