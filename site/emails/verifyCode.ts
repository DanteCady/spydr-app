import { esc, layout, p, panel, type Email } from './layout'
import { TTL_MINUTES } from '@/lib/server/otp'

/**
 * The code that proves an address is readable by whoever asked for a key.
 *
 * The code is in the subject line as well as the body, because a six-digit number is the entire
 * point of the message and half of people will read it from the notification without opening it.
 */
export function verifyCodeEmail(code: string): Email {
  const body = [
    p('Here is the code to confirm your email address and get your SPYDIR licence key.'),
    panel(code),
    p(`It expires in ${TTL_MINUTES} minutes and can only be used once.`),
    p(
      `<span style="color:#5c6675;">If you did not ask for a licence key, you can ignore this. No key has been created, and nothing will be unless the code is used.</span>`
    )
  ].join('\n')

  const text = [
    'Confirm your email address',
    '',
    `Your SPYDIR verification code is: ${code}`,
    '',
    `It expires in ${TTL_MINUTES} minutes and can only be used once.`,
    '',
    'If you did not ask for a licence key, ignore this email. No key has been created,',
    'and nothing will be unless the code is used.',
    '',
    '— SPYDIR · spydir.io'
  ].join('\n')

  return {
    subject: `${code} is your SPYDIR verification code`,
    html: layout({ preview: `${esc(code)} — expires in ${TTL_MINUTES} minutes`, body }),
    text
  }
}
