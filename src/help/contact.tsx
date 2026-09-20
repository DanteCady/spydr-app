import { FEEDBACK_EMAIL, SECURITY_EMAIL, SITE_DOMAIN, SUPPORT_EMAIL } from '@shared/contact'
import { MailButton, Term, type Article } from './kit'

export const CONTACT: Article[] = [
  {
    id: 'contact',
    section: 'Operating',
    title: 'Getting help',
    blurb: 'How to reach us, and what to include so the first reply is useful.',
    keywords: 'contact support email help bug report feature request security vulnerability licence key lost',
    body: (
      <>
        <p>
          SPYDR is free, and support is a real person reading email rather than a ticket queue. There are three
          addresses, because they get read by different people in different moods.
        </p>
        <dl className="kb-terms">
          <Term name={SUPPORT_EMAIL}>
            Something is broken, something is confusing, or SPYDR read your directory in a way you did not expect.
          </Term>
          <Term name={FEEDBACK_EMAIL}>
            An idea, a request, or an opinion about how something works. Slower to answer, and read just as closely.
          </Term>
          <Term name={SECURITY_EMAIL}>
            A vulnerability. Read first and answered before anything else — see below.
          </Term>
        </dl>

        <MailButton to="support" />

        <h3>What to include</h3>
        <p>
          The difference between a one-reply answer and a week of back and forth is usually whether the first message
          says what happened, what you expected instead, and what SPYDR was doing at the time.
        </p>
        <dl className="kb-terms">
          <Term name="The version">
            In the guide under <strong>About SPYDR</strong>, or in <strong>Settings &rsaquo; About</strong>. The
            button above fills it in for you.
          </Term>
          <Term name="What you were doing">
            Which workspace, and which action. &ldquo;Re-crawl on a 40,000-object domain&rdquo; narrows things much
            faster than &ldquo;it crashed&rdquo;.
          </Term>
          <Term name="What you saw">
            The exact message, if there was one. A screenshot is fine — but please read it first, since a directory
            on screen usually has real account names on it.
          </Term>
          <Term name="Roughly how big">
            Objects, groups, OUs. Several problems only appear past a certain size, and this is the fastest way to
            tell whether yours is one of them.
          </Term>
        </dl>

        <h3>Please do not send us your directory</h3>
        <p>
          A snapshot is your organisation&rsquo;s structure — every account, group and membership in it. We do not
          want a copy and cannot look after one properly. If a problem cannot be described without the data, say so
          and we will work out a way to narrow it down that does not involve sending it: a count, a shape, a single
          object with the names changed.
        </p>

        <h3>Reporting a security problem</h3>
        <p>
          Mail <span className="mono-hint">{SECURITY_EMAIL}</span>. SPYDR is run by people holding domain
          administrator credentials against production domain controllers, so anything touching that is answered
          before whatever else is in the queue — expect a reply within a few days, and a name in the release notes
          if you would like one.
        </p>
        <p>
          Please describe the class of problem rather than publishing a working exploit, and give us a chance to fix
          it before you write it up. If it affects the licence server rather than the app, say so — they are
          different systems with different blast radii.
        </p>
        <MailButton to="security" />

        <h3>A licence key you have lost</h3>
        <p>
          Keys are issued one per address and are not shown twice, but they can always be sent again. Ask at{' '}
          <span className="mono-hint">{SITE_DOMAIN}/key</span> using the address you signed up with, and the key
          goes to that address — never to whoever asked, which is also why the page answers the same way whether or
          not it found anything.
        </p>

        <h3>Asking for something SPYDR does not do</h3>
        <p>
          Worth sending, to <span className="mono-hint">{FEEDBACK_EMAIL}</span>. The useful version is the problem
          rather than the feature: &ldquo;I need to prove to an
          auditor that nobody outside IT can reach this group&rdquo; tells us more than &ldquo;add a report
          builder&rdquo;, and often turns out to be answerable with something already in the tool.
        </p>
        <MailButton to="feedback" />
        <p className="muted">
          Bear in mind SPYDR is read-only by design. Requests that amount to &ldquo;and then fix it for me&rdquo; are
          not an oversight we are going to correct — that boundary is the reason it is safe to point at a production
          domain controller.
        </p>
      </>
    )
  }
]
