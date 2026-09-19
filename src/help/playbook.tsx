import { Term, type Article } from './kit'

export const PLAYBOOK: Article[] = [
  {
    id: 'playbook',
    section: 'Start here',
    title: 'Making the most of SPYDR',
    blurb: 'The workflows it was built around, in the order they pay off.',
    keywords: 'workflow playbook howto best practice access review offboarding cleanup routine tips',
    body: (
      <>
        <p>
          SPYDR rewards a habit more than a session. What follows is the sequence that gets the most out of it, from a
          first read to a directory you can answer questions about on demand.
        </p>

        <h3>Your first half hour</h3>
        <ol className="kb-steps">
          <li>
            <strong>Open the sample first.</strong> Every view is easier to learn on a directory whose problems you
            already know are there. Five minutes here saves an hour of squinting at your own domain wondering whether
            the tool or the directory is wrong.
          </li>
          <li>
            <strong>Connect as an ordinary user.</strong> Reading needs no privilege. If the read fails, that is
            information about your directory, not a reason to reach for an admin account.
          </li>
          <li>
            <strong>Name your Tier-0 groups</strong> in Settings ▸ Hygiene rules, before you read anything into the
            score. Out of the box SPYDR only knows Microsoft's four privileged groups. Your real crown jewels are
            probably called something like <code>Tier0-ServerAdmins</code>, and until you say so, every path into them
            is invisible to the rules.
          </li>
          <li>
            <strong>Then look at the score</strong> — and ignore the number itself. What matters is the shape of the
            findings under it.
          </li>
        </ol>

        <h3>Answering "why does this person have admin?"</h3>
        <p>
          The question SPYDR exists for. Pathfinder ▸ <em>How does an account reach a group?</em>, the person on the
          left, the group on the right. You get every chain, and the links they share.
        </p>
        <p>
          Read the cut analysis before you touch anything. If two chains both pass through{' '}
          <code>IT-Admins → Tier0</code>, removing the person from IT-Admins changes nothing — they still arrive the
          other way. The shared link is the one change that works.
        </p>
        <p>
          Then <strong>Trace on the canvas</strong> and screenshot it. A picture of the chain persuades a change board
          in a way a list of DNs does not.
        </p>

        <h3>Running an access review</h3>
        <p>
          Pathfinder ▸ <em>Who is really in a group?</em>, once per privileged group. The number at the top is the one
          your review actually needs: four accounts end up in Domain Admins, three of which are not in its member list.
        </p>
        <p>
          Work down the list from the deepest. An account four levels away from a group it grants admin over is rarely
          there on purpose — it is usually a role group that was nested into another role group for one project in
          2021.
        </p>
        <p>
          Generate the PDF at the end and attach it to the review. It records the thresholds it ran under, so the next
          reviewer can tell whether their numbers are comparable to yours.
        </p>

        <h3>Verifying an offboarding</h3>
        <p>
          The workflow that catches the failure nobody notices. Before the change, Pathfinder the departing account
          against each privileged group and note every chain. After the change, <strong>Re-crawl</strong> and look
          again.
        </p>
        <p>
          Re-crawl reports the difference — memberships removed, findings moved — so "the ticket was closed" becomes
          "the access is gone", which are not the same claim.
        </p>

        <h3>A cleanup campaign</h3>
        <p>
          Cycles and deep nesting first: they are the findings that make everything else hard to reason about, and
          fixing one often removes several others. Work in the Web canvas in Structure mode to see what you are
          untangling.
        </p>
        <p>
          Stale and disabled accounts next, as a batch rather than one at a time. Tune the stale threshold to something
          your organisation would defend — 90 days is a default, not a policy — and filter the Hygiene table to that
          rule alone.
        </p>
        <p>
          Empty and redundant groups last. They are low severity because they are low risk, but they are also the
          cheapest to close and they make every later review shorter.
        </p>

        <h3>Making the score mean something</h3>
        <p>
          Re-read on a schedule — monthly is plenty — and keep the thresholds identical between reads. A score that
          moves because you changed the definition of stale tells you nothing. A score that moves because you closed
          forty findings is a number you can take to a manager.
        </p>
        <p>
          Keep the PDFs. Three reports across a quarter is a trend, and a trend is far more persuasive than any single
          snapshot.
        </p>

        <h3>Habits that pay off</h3>
        <dl className="kb-terms">
          <Term name="Re-crawl before you conclude anything">
            The header says how old the read is for a reason. Half the confusing results in any directory tool are a
            stale snapshot.
          </Term>
          <Term name="Turn off rules that do not apply to you">
            A directory that deliberately runs deep nesting does not need that rule shouting on every read. Silencing
            it honestly beats learning to ignore it.
          </Term>
          <Term name="Turn off computers on a big domain">
            They are often half the objects and hold no membership worth walking. The read gets dramatically faster.
          </Term>
          <Term name="Use the canvas to explain, not to explore">
            Exploring is faster in Directory and Pathfinder. The canvas earns its place when you need someone else to
            see what you found.
          </Term>
          <Term name="Bind to the DC you are about to change">
            Replication lag turns a correct change into a confusing one. Read the controller you are working against.
          </Term>
        </dl>
      </>
    )
  },
  {
    id: 'limits',
    section: 'Concepts',
    title: 'What SPYDR does not see',
    blurb: 'The boundary of the tool, stated plainly.',
    keywords: 'limits limitations acl permissions gpo delegation adminsdholder entra azure trusts sidhistory bloodhound',
    body: (
      <>
        <p>
          SPYDR reads group membership and account state. That covers a great deal of what goes wrong in a directory,
          and it is not everything. Knowing the edge matters, because a clean score is not a clean bill of health.
        </p>

        <h3>Permissions and ACLs</h3>
        <p>
          SPYDR does not read the security descriptor on any object. An account with <code>GenericAll</code> over an
          OU, or write access to a group's membership, can grant itself whatever it likes — and SPYDR will show it as
          an ordinary user, because by membership it is one. Directory ACL analysis is a different discipline; tools
          built for it, like BloodHound, exist for that reason.
        </p>

        <h3>Delegation and its relatives</h3>
        <p>
          Constrained and unconstrained delegation, resource-based delegation, and accounts trusted for delegation are
          all attributes SPYDR does not currently examine. They are a real privilege-escalation path and they are
          invisible here.
        </p>

        <h3>Group Policy</h3>
        <p>
          What a GPO does, where it is linked, and what it grants — none of it. A group can confer administrative
          rights on every workstation through a policy with no nesting involved at all.
        </p>

        <h3>Resource access</h3>
        <p>
          Which shares, mailboxes, applications or databases a group actually opens is outside the directory. SPYDR can
          tell you that forty people are effectively in a group; it cannot tell you what that group unlocks.
        </p>

        <h3>Other directories and identities</h3>
        <p>
          One domain per read, from one controller. Cross-domain and cross-forest trusts, <code>sIDHistory</code>{' '}
          carried over from a migration, and anything in Entra ID or another cloud directory are all out of scope.
          <code>ForeignSecurityPrincipals</code> appears as an object, but what it points at lives elsewhere.
        </p>

        <h3>Protected accounts</h3>
        <p>
          AdminSDHolder quietly rewrites the ACL of anyone in a protected group, and keeps doing so after they leave
          it. SPYDR does not track <code>adminCount</code> or that behaviour, so an account that used to be privileged
          may still carry its fingerprints.
        </p>

        <h3>Time</h3>
        <p>
          A snapshot, not a history. SPYDR can compare the read you have open with a fresh one, and it does not know
          what your directory looked like last year, who made a change, or when. That is what your audit log is for.
        </p>

        <h3>What that leaves</h3>
        <p>
          Within its boundary — who is in what, how they got there, what has gone stale, and where nesting has become
          unreadable — SPYDR is thorough, and that boundary covers the questions most directories fail on first. Treat
          a good score as "membership is tidy", not as "this domain is secure".
        </p>
      </>
    )
  }
]
