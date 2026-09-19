import { RULES } from '@shared/engine/registry'
import { DEFAULT_CONFIG } from '@shared/engine/rule'
import { MENU, type MenuEntry } from '@shared/menu'
import { Keys, Term, type Article } from './kit'

function shortcutRows(): { section: string; label: string; accelerator: string }[] {
  const rows: { section: string; label: string; accelerator: string }[] = []
  const walk = (section: string, items: MenuEntry[]): void => {
    for (const item of items) {
      if (item.submenu) walk(section, item.submenu)
      else if (item.accelerator && item.label) rows.push({ section, label: item.label, accelerator: item.accelerator })
    }
  }
  for (const section of MENU) walk(section.label, section.items)
  return rows
}

export const CONCEPTS: Article[] = [
  {
    id: 'nesting',
    section: 'Concepts',
    title: 'Why nested groups are the problem',
    blurb: 'The AD behaviour every finding here comes back to.',
    keywords: 'nesting token effective membership primary group tiering acl scope',
    body: (
      <>
        <p>
          A group can contain another group. That one line is where most of the mess in a mature directory comes from,
          because the tools that show you membership mostly show one level of it.
        </p>
        <p>
          Open Domain Admins in ADUC and you see its <em>direct</em> members. If someone put a role group inside it
          three years ago, and someone else later put a team group inside that, the people in the team group are Domain
          Admins — and they appear nowhere in that list. Their access is real; its visibility is not.
        </p>
        <h3>Why it happens</h3>
        <p>
          Nesting is not a mistake. It is the recommended way to build a directory: put people in role groups, put role
          groups in resource groups, grant permissions to resource groups. The structure is sound. What goes wrong is
          that it accumulates — each admin adds a level to solve their problem, nobody removes one, and after a decade
          the chain is five deep and predates everyone in the room.
        </p>
        <h3>What SPYDR does about it</h3>
        <p>
          It reads every <code>member</code> link in the directory, builds the whole graph, and walks it. That is what
          Pathfinder enumerates, what the canvas draws, and what most rules examine. Effective membership becomes
          something you look at rather than something you reason about.
        </p>
        <h3>The bit that is easy to miss</h3>
        <p>
          A user's <strong>primary group</strong> — usually Domain Users — is not stored as a membership at all. It is
          a RID on the account, and appears in neither the group's member list nor the user's memberOf. SPYDR resolves
          it and draws it as a dashed edge, so what you see matches the token a user actually receives.
        </p>
        <h3>Where nesting stops</h3>
        <p>
          Group scope limits what can nest inside what — a global group can hold members from its own domain only, a
          domain-local group can hold members from anywhere but grants access only in its own domain, and a universal
          group crosses the forest at the cost of replication. SPYDR shows the scope of every group in the inspector,
          because a nesting that looks wrong is sometimes a scope boundary someone worked around.
        </p>
      </>
    )
  },
  {
    id: 'rules',
    section: 'Concepts',
    title: 'The hygiene rules',
    blurb: `All ${RULES.length} rules: what each looks for, and why it matters.`,
    keywords: 'findings detectors severity critical high medium low cleanup',
    body: (
      <>
        <p>
          Every rule runs over the membership graph after a read, and again whenever you change a threshold. Each can be
          turned off in Settings if it does not fit your environment.
        </p>
        {RULES.map((rule) => (
          <div className="kb-rule" key={rule.id}>
            <h3>
              {rule.name}
              <span className={`badge ${rule.severity}`}>{rule.severity}</span>
            </h3>
            <p className="kb-rule-what">{rule.describe}</p>
            <p>{rule.why}</p>
          </div>
        ))}
        <h3>Thresholds</h3>
        <p>
          Stale means no logon in {DEFAULT_CONFIG.staleDays} days. Deep means more than {DEFAULT_CONFIG.deepNesting}{' '}
          levels. Both are defaults you can change in Settings, and both should match how your organisation actually
          works.
        </p>
        <h3>What the rules deliberately ignore</h3>
        <p>
          Groups Active Directory creates itself are excluded from the cleanup rules: an empty Cryptographic Operators
          is normal, not mess. They are never excluded from privilege analysis, because Domain Admins is built-in and
          is exactly what matters.
        </p>
      </>
    )
  },
  {
    id: 'score',
    section: 'Concepts',
    title: 'How the score works',
    blurb: 'What 58 out of 100 means, and what moves it.',
    keywords: 'hygiene score weighting severity penalty saturating curve',
    body: (
      <>
        <p>
          Each finding carries a weight by severity: critical 12, high 6, medium 3, low 1. Those are summed into a
          penalty, and the score is <code>100 × 100 ÷ (100 + penalty)</code>.
        </p>
        <h3>Why that curve</h3>
        <p>
          A linear penalty hits zero on any real domain and stops telling you anything — a directory with a thousand
          stale accounts would score the same zero as one with ten thousand, and fixing four hundred of them would
          change nothing on screen. This curve saturates instead: the number always has further to fall, and closing
          anything always moves it up.
        </p>
        <h3>How to read it</h3>
        <p>
          As a direction of travel, not a grade. A large domain scores lower than a small one with identical
          discipline, simply because it has more objects to have findings about. Comparing your score to another
          organisation's is meaningless; comparing this month's to last month's is the entire point.
        </p>
        <p>
          The report states the score in words as well as numbers — healthy, good, needs attention, at risk — because a
          number alone invites an argument about the number.
        </p>
      </>
    )
  },
  {
    id: 'icons',
    section: 'Concepts',
    title: 'Objects, icons and badges',
    blurb: 'The visual vocabulary, in one place.',
    keywords: 'icons glyphs badges privileged disabled stale colours legend types',
    body: (
      <>
        <p>Every icon in SPYDR is chosen from what the object actually is, not just its class.</p>
        <h3>Objects</h3>
        <dl className="kb-terms">
          <Term name="Users">
            A person. A disabled account gets a struck-through figure, so a disabled user is recognisable before you
            read the badge.
          </Term>
          <Term name="Groups">
            A security group is a pair of figures. A <em>privileged</em> group — the built-in four, plus any you named
            in Settings — is a shield. A mail distribution group is an @, because it is a mailing list and not an
            access grant, and telling them apart at a glance is the point of the distinction.
          </Term>
          <Term name="Computers">A laptop, or a server when the operating system says so.</Term>
          <Term name="Containers and OUs">
            The domain root is a globe. Builtin, Users, Computers, Domain Controllers and Managed Service Accounts each
            have their own mark. An OU at the top level is a folder; a sub-OU is a nested folder; deeper than that, the
            icon comes from what the OU mostly holds, so an OU full of groups looks like groups.
          </Term>
        </dl>
        <h3>Badges</h3>
        <dl className="kb-terms">
          <Term name="Privileged">
            This group is one whose membership grants administrative power. Applies to the AD built-ins and anything
            you added under Settings.
          </Term>
          <Term name="Disabled">
            The account is disabled — <code>userAccountControl</code> bit 2. It still holds every membership it had.
          </Term>
          <Term name="Stale">
            No logon within the stale threshold. Remember that the attribute behind it lags by up to two weeks, so this
            is a shortlist to confirm rather than a verdict.
          </Term>
        </dl>
        <h3>On the canvas</h3>
        <p>
          Colour follows type — users, groups, computers, containers each have their own. A dashed outline marks a node
          that sits in a membership cycle. A solid edge is an explicit <code>member</code> link; a dashed edge is a
          primary group. The legend is on screen whenever you want it.
        </p>
      </>
    )
  },
  {
    id: 'reading',
    section: 'Concepts',
    title: 'Reading a real directory',
    blurb: 'Paging, timeouts, and the attributes AD does not keep current.',
    keywords: 'maxpagesize ranged retrieval lastlogontimestamp replication timeout large domain performance',
    body: (
      <>
        <h3>Paging</h3>
        <p>
          Domain controllers cap how many entries one search returns — <code>MaxPageSize</code>, 1000 by default.
          SPYDR pages at 500 and stitches the pages together. If your DC enforces something smaller, lower the page
          size in Settings under Connection.
        </p>
        <h3>Large groups</h3>
        <p>
          A group with more than about 1500 members does not return them all at once; AD hands them back in ranges.
          SPYDR requests each range until the group is complete, so a group of 20,000 is read correctly — it just takes
          more round trips. This is also why a domain with a few enormous groups takes longer than its object count
          suggests.
        </p>
        <h3>Last logon is approximate, by design</h3>
        <p>
          SPYDR reads <code>lastLogonTimestamp</code>, which replicates between controllers — but only when it changes
          by more than a replication window, 14 days by default. An account that logged on yesterday can legitimately
          show a timestamp two weeks old. The precise attribute, <code>lastLogon</code>, is not replicated at all and
          would have to be read from every DC in the domain and reconciled to mean anything.
        </p>
        <p>
          So treat stale findings as a shortlist. They are reliable for "nobody has touched this in a year" and
          unreliable for "this account was idle last week".
        </p>
        <h3>Which controller you read</h3>
        <p>
          You read one DC, and it answers with its own replica. A change made on another controller minutes ago may not
          be there yet. When a re-crawl disagrees with what you just did, replication lag is the first thing to suspect.
        </p>
        <h3>Speed</h3>
        <p>
          Computers are often half the objects in a directory and hold no membership of their own beyond a primary
          group. Turning them off in Settings can halve a read. Narrowing the base DN to one OU is faster still, at the
          cost of an incomplete membership graph.
        </p>
      </>
    )
  },
  {
    id: 'privacy',
    section: 'Operating',
    title: 'Privacy and safety',
    blurb: 'What SPYDR reads, what it keeps, and what it never does.',
    keywords: 'security read-only password safestorage telemetry session consent encryption permissions',
    body: (
      <>
        <h3>Read-only, structurally</h3>
        <p>
          SPYDR issues searches. It contains no add, modify, or delete operation against LDAP, so no bug and no misclick
          can change your directory. Suggested fixes are text for you to carry out elsewhere, deliberately.
        </p>
        <h3>What it needs from you</h3>
        <p>
          An ordinary domain user. Reading the directory requires no special privilege, and SPYDR asks for none. If you
          are being asked to hand a tool Domain Admin to read group membership, something is wrong with the tool.
        </p>
        <h3>Passwords</h3>
        <p>
          A bind password is held in memory by the main process for the session, so Re-crawl can read again without
          asking. It is never sent to the interface, never written to the session file, and dropped on disconnect and
          on quit.
        </p>
        <h3>What lands on disk</h3>
        <p>
          Only what you agree to. Session restore needs a copy of the snapshot on this machine — compressed, and
          encrypted with the OS keychain where one exists. SPYDR asks once, and declining removes anything already
          written. Reports go where you choose to save them.
        </p>
        <h3>Nothing leaves the machine</h3>
        <p>
          No telemetry, no analytics, no crash reporting, no licence check. The only connection SPYDR opens is to the
          domain controller you name — and to an update feed if you configure one, which is off by default and
          contacts nothing until you fill it in.
        </p>
      </>
    )
  },
  {
    id: 'trouble',
    section: 'Operating',
    title: 'When a connection fails',
    blurb: 'What the common bind errors actually mean.',
    keywords: 'error troubleshooting certificate 49 invalid credentials timeout refused referral lockout',
    body: (
      <>
        <dl className="kb-terms">
          <Term name="Invalid credentials (LDAP 49)">
            The bind was rejected. Check the account, the password, and the format — <code>DOMAIN\\user</code> or a
            UPN. A correct password against the wrong domain prefix fails identically. Confirm the credentials
            elsewhere before retrying: repeated attempts lock the account out.
          </Term>
          <Term name="Certificate errors on LDAPS">
            The controller is presenting a certificate this machine does not trust, usually from an internal CA that
            was never distributed. Install the CA certificate, or tick trust self-signed for that connection.
          </Term>
          <Term name="Connection refused, or a timeout">
            Nothing is listening where SPYDR looked. Check the port matches the protocol — 636 for LDAPS, 389 for LDAP
            and StartTLS — that the host really is a domain controller, and that a firewall is not in the way. Raise
            the connect timeout in Settings for a slow link.
          </Term>
          <Term name="Could not read defaultNamingContext">
            The bind worked, but the rootDSE said nothing useful, which usually means the host is not a domain
            controller. Enter a Base DN explicitly to read anyway.
          </Term>
          <Term name="A read that takes far too long">
            Usually an enormous group being read in ranges, or a DC under load. Lower the page size, turn off
            computers, or narrow the base DN. A slow link benefits more from fewer round trips than from smaller pages.
          </Term>
          <Term name="Run SPYDR as the desktop app">
            The interface is running without its privileged half — in a browser, or from a broken build. LDAP binding
            lives in the desktop application only.
          </Term>
        </dl>
      </>
    )
  },
  {
    id: 'shortcuts',
    section: 'Operating',
    title: 'Keyboard shortcuts',
    blurb: 'Everything with an accelerator, written for this platform.',
    keywords: 'keys hotkeys accelerator command control windows mac linux',
    body: (
      <>
        <p>
          Taken from the menu definition, so this list cannot drift from what the menus actually do. Keys are shown the
          way this operating system writes them.
        </p>
        <table className="kb-keys">
          <tbody>
            {shortcutRows().map((row) => (
              <tr key={`${row.section}:${row.label}`}>
                <td className="muted">{row.section}</td>
                <td>{row.label}</td>
                <td>
                  <Keys accelerator={row.accelerator} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    )
  }
]
