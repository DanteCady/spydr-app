/**
 * Where to reach a person, stated once.
 *
 * The app's guide and the website both publish these, and an address that appears in two places
 * eventually appears in two spellings — usually noticed when someone's email bounces rather than
 * when the typo is made.
 *
 * Three addresses rather than one, because they are read by different people in different moods:
 * something broken needs answering today, an idea can wait a week, and a vulnerability report
 * must not sit in a queue behind either of them.
 */

export const SITE_DOMAIN = 'spydir.io'
export const SITE_URL = `https://${SITE_DOMAIN}`

/** Something is wrong, or something is unclear. */
export const SUPPORT_EMAIL = `support@${SITE_DOMAIN}`
/** An idea, a request, or an opinion about how SPYDR works. */
export const FEEDBACK_EMAIL = `feedback@${SITE_DOMAIN}`
/** A vulnerability. Read first, and answered before anything else. */
export const SECURITY_EMAIL = `security@${SITE_DOMAIN}`

interface MailOptions {
  subject?: string
  version?: string
  platform?: string
  objects?: number
  /** The prompts the message body opens with, one per blank the writer should fill in. */
  prompts?: string[]
}

/**
 * A mailto with the subject and the build details already filled in.
 *
 * Nearly every answer to a support question starts by asking which version, on which platform,
 * against which directory size — so the message arrives with that in it rather than costing a
 * round trip. Nothing here identifies a directory: a version, a platform, and counts.
 */
export function mailTo(address: string, options: MailOptions = {}): string {
  const facts = [
    options.version ? `Version: ${options.version}` : null,
    options.platform ? `Platform: ${options.platform}` : null,
    typeof options.objects === 'number' ? `Directory size: about ${options.objects} objects` : null
  ].filter(Boolean)

  const prompts = options.prompts ?? ['What happened:', 'What you expected instead:']
  const body = [
    ...prompts.flatMap((prompt) => [prompt, '', '']),
    ...(facts.length > 0 ? ['—', ...facts] : [])
  ].join('\n')

  const subject = options.subject ?? 'SPYDR'
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export function supportMailto(options: Omit<MailOptions, 'prompts'> = {}): string {
  return mailTo(SUPPORT_EMAIL, { subject: 'SPYDR support', ...options })
}

export function feedbackMailto(options: Omit<MailOptions, 'prompts'> = {}): string {
  return mailTo(FEEDBACK_EMAIL, {
    subject: 'SPYDR feedback',
    // Asking for the problem rather than the feature, in the shape of the message itself.
    prompts: ['What you were trying to do:', 'What would have made it easier:'],
    ...options
  })
}

export function securityMailto(options: Omit<MailOptions, 'prompts'> = {}): string {
  return mailTo(SECURITY_EMAIL, {
    subject: 'SPYDR security report',
    prompts: ['What you found:', 'How to reproduce it:', 'What it would let someone do:'],
    ...options
  })
}
