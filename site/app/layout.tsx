import type { Metadata } from 'next'
import { IBM_Plex_Mono, IBM_Plex_Sans } from 'next/font/google'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import { WidowSprite } from '@/components/WidowMark'
import './globals.css'

const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap'
})
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap'
})

/** Overridden per environment so preview deployments do not advertise the production URL. */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://spydir.io'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: '/' },
  title: {
    default: 'SPYDR — read-only Active Directory explorer',
    template: '%s — SPYDR'
  },
  description:
    'SPYDR reads your Active Directory and answers what a member list cannot: who is really in this group, how did they get there, and what has quietly stopped making sense. Read-only, local, no telemetry.',
  openGraph: {
    title: 'SPYDR — read-only Active Directory explorer',
    description: 'Who is really in this group, how did they get there, and what has quietly stopped making sense.',
    type: 'website',
    url: SITE_URL,
    siteName: 'SPYDR'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SPYDR — read-only Active Directory explorer',
    description: 'Who is really in this group, how did they get there, and what has quietly stopped making sense.'
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <WidowSprite />
      </body>
    </html>
  )
}
