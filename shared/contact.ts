/**
 * Where to reach a person, stated once.
 *
 * The app's guide and the website both publish these, and an address that appears in two places
 * eventually appears in two spellings — usually noticed when someone's email bounces rather than
 * when the typo is made.
 */

export const SUPPORT_EMAIL = 'support@spydir.io'
export const SITE_DOMAIN = 'spydir.io'
export const SITE_URL = `https://${SITE_DOMAIN}`

/**
 * A mailto with the subject and the build details already filled in.
 *
 * Nearly every answer to a support question starts by asking which version, on which platform,
 * against which directory size — so the message arrives with that in it rather than costing a
 * round trip. Nothing here identifies a directory: a version, a platform, and counts.
 */
export function supportMailto(options: {
  subject?: string
  version?: string
  platform?: string
  objects?: number
} = {}): string {
  const subject = options.subject ?? 'SPYDR support'
  const facts = [
    options.version ? `Version: ${options.version}` : null,
    options.platform ? `Platform: ${options.platform}` : null,
    typeof options.objects === 'number' ? `Directory size: about ${options.objects} objects` : null
  ].filter(Boolean)

  const body = [
    'What happened:',
    '',
    '',
    'What you expected instead:',
    '',
    '',
    ...(facts.length > 0 ? ['—', ...facts] : [])
  ].join('\n')

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
