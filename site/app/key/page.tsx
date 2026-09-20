import { RecoverKey } from '@/components/RecoverKey'

export const metadata = {
  title: 'Find your licence key',
  description: 'Have your SPYDR licence key sent again to the address that owns it.'
}

/**
 * The page for "I have lost my key".
 *
 * The endpoint behind this has existed and worked for a while with nothing linking to it, which
 * made self-service recovery a raw JSON POST — so in practice a free product locked people out
 * until a human answered an email.
 */
export default function KeyPage() {
  return (
    <article className="doc doc-narrow">
      <p className="kb-crumb mono">Licence</p>
      <h1>Find your key</h1>
      <p className="doc-lede">
        Keys are issued one per address and are not shown twice, but they can always be sent again —
        to the address that owns them, and nowhere else.
      </p>
      <RecoverKey />
      <h2>If nothing arrives</h2>
      <p>
        Check the spam folder first; a message with a licence key in it is exactly the shape filters dislike. If it
        is genuinely not there, the address may not be the one you signed up with — try the other one, or write to{' '}
        <span className="mono-hint">support@spydir.io</span> and a person will sort it out.
      </p>
      <h2>Do I need a key at all?</h2>
      <p>
        To read your own directory, yes. To look around the sample directory, no — that opens without one, from the
        button on SPYDR&rsquo;s first screen.
      </p>
    </article>
  )
}
