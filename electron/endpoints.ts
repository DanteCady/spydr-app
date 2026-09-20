import { app } from 'electron'

/**
 * Where the licence server and the signup page live.
 *
 * A development build talks to the site running next door rather than to production, so activating
 * while working on SPYDR issues a key against the local database and the "get a free key" link
 * lands somewhere that exists. SPYDR_LICENSE_API overrides both, for pointing a build at staging.
 *
 * The override is ignored in a packaged build. Anything that can set a variable in the user's
 * environment could otherwise point activation and telemetry at a host of its choosing, and a
 * shipped SPYDR has no reason to talk to anywhere but production.
 */
const DEV_SITE = 'http://localhost:4200'
const PRODUCTION_SITE = 'https://getspydr.com'

export function siteBase(): string {
  if (app.isPackaged) return PRODUCTION_SITE
  const override = process.env.SPYDR_LICENSE_API?.trim()
  if (override) return override.replace(/\/$/, '')
  return DEV_SITE
}

export function apiBase(): string {
  return siteBase()
}
