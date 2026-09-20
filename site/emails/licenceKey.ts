import { esc, layout, p, panel, type Email } from './layout'

/**
 * The key itself, sent once on signup and again whenever it is asked for.
 *
 * Both cases send the same email on purpose. A "here it is again" variant would be a slightly
 * different message telling the reader that this address was already registered — which is the
 * fact the recovery endpoint works hard not to disclose.
 */
export function licenceKeyEmail(key: string): Email {
  const body = [
    p('Here is your SPYDIR licence key.'),
    panel(key),
    p(
      'Enter it when SPYDIR asks on first run, or later under <strong>Settings &rsaquo; Licence</strong>. It is checked once now and about once a month after that — and if that check falls due while you are offline, SPYDIR keeps working and says so.'
    ),
    p(
      '<span style="color:#5c6675;">One key per address. Keep this email; if you lose the key we can send it here again, but only ever to this address.</span>'
    )
  ].join('\n')

  const text = [
    'Your SPYDIR licence key',
    '',
    `    ${key}`,
    '',
    'Enter it when SPYDIR asks on first run, or later under Settings > Licence.',
    'It is checked once now and about once a month after that. If that check falls',
    'due while you are offline, SPYDIR keeps working and says so.',
    '',
    'One key per address. Keep this email; if you lose the key we can send it here',
    'again, but only ever to this address.',
    '',
    '— SPYDIR · spydir.io'
  ].join('\n')

  return {
    subject: 'Your SPYDIR licence key',
    html: layout({
      preview: 'Your licence key, and where to enter it',
      body,
      footer:
        'You are receiving this because a licence key was issued or requested for this address at spydir.io. Keys are only ever sent to the address that owns them.'
    }),
    text
  }
}
