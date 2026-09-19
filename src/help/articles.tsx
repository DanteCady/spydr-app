import type { ReactNode } from 'react'
import { RULES } from '@shared/engine/registry'
import { DEFAULT_CONFIG } from '@shared/engine/rule'
import { MENU, type MenuEntry } from '@shared/menu'

/**
 * The knowledge base. Anything that exists elsewhere as data — the rules, the menu — is rendered
 * from that data rather than retyped, so the help cannot drift from the app it describes.
 */
export interface Article {
  id: string
  title: string
  blurb: string
  /** Extra words the filter should match, beyond the visible text. */
  keywords?: string
  body: ReactNode
}

function Term({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="kb-term">
      <dt>{name}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/**
 * Accelerators as the platform writes them. Split into parts before substituting, so a literal
 * "Plus" does not get mistaken for the separator and vanish.
 */
function keys(accelerator: string): string {
  const mac = navigator.platform.toLowerCase().includes('mac')
  const names: Record<string, string> = {
    CmdOrCtrl: mac ? '⌘' : 'Ctrl',
    Cmd: '⌘',
    Ctrl: 'Ctrl',
    Shift: mac ? '⇧' : 'Shift',
    Alt: mac ? '⌥' : 'Alt',
    Plus: '+'
  }
  return accelerator
    .split('+')
    .map((part) => names[part] ?? part)
    .join(mac ? '' : '+')
}

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

export const ARTICLES: Article[] = [
  {
    id: 'start',
    title: 'Getting started',
    blurb: 'Open the sample, or bind to a domain controller.',
    keywords: 'connect bind ldaps credentials base dn rootdse sample restore',
    body: (
      <>
        <p>
          SPYDR reads a directory once, into memory, and everything after that happens locally. It never writes to
          Active Directory — there is no code in it that can add, modify, or delete an object.
        </p>
        <h3>Two ways in</h3>
        <p>
          <strong>Open sample directory</strong> loads a small fictional domain with the problems SPYDR looks for
          already in it: a nesting cycle, a path into Domain Admins, stale and disabled accounts. Nothing is read from
          your network. It is the fastest way to learn what the views mean.
        </p>
        <p>
          <strong>Connect to a domain</strong> binds to a real domain controller. Bind as an ordinary domain user —
          reading the directory needs no privilege, and SPYDR asks for none. Do not bind as Domain Admin out of habit.
        </p>
        <h3>The connection fields</h3>
        <dl className="kb-terms">
          <Term name="Domain FQDN">
            Your domain's DNS name, such as <code>corp.example.com</code>. With it SPYDR can find a domain controller
            over DNS SRV records, so you can leave the host blank.
          </Term>
          <Term name="Domain controller">
            A specific DC by hostname or IP. Fill this in when DNS discovery fails, or when you want to read one
            particular replica.
          </Term>
          <Term name="Protocol">
            <strong>LDAPS (636)</strong> is TLS from the first byte and the right default. <strong>StartTLS (389)</strong>{' '}
            opens in the clear and upgrades. <strong>LDAP (389)</strong> never encrypts — your bind password crosses the
            network in the open, so use it only against a lab.
          </Term>
          <Term name="Bind as">
            <code>DOMAIN\\user</code> or a UPN such as <code>user@corp.example.com</code>. Both work.
          </Term>
          <Term name="Base DN (blank = rootDSE)">
            Where to start reading. Left blank, SPYDR asks the DC for its <code>defaultNamingContext</code> and reads
            the whole domain, which is what you usually want. Set it to an OU — <code>OU=Corp,DC=corp,DC=example,DC=com</code>{' '}
            — to read only that subtree, which is faster on a large directory but will miss memberships held outside it.
          </Term>
          <Term name="Trust self-signed certificate">
            Accepts a DC certificate your machine does not trust. Common on lab and internal CAs. It disables
            certificate verification for that connection, so leave it off against production unless you know why you
            need it.
          </Term>
        </dl>
      </>
    )
  },
  {
    id: 'workspaces',
    title: 'The five workspaces',
    blurb: 'What each view answers, and when to reach for it.',
    keywords: 'directory web pathfinder hygiene settings navigation',
    body: (
      <>
        <dl className="kb-terms">
          <Term name="Directory">
            The familiar tree, like ADUC. Browse OUs, see what is in them, and select any object to inspect it. Start
            here when you know what you are looking for. The search box at the top matches name, SAM account name, UPN
            and description across the whole directory.
          </Term>
          <Term name="Web">
            The membership graph, drawn. Nesting that is impossible to hold in your head as a list becomes obvious as a
            picture. <strong>Tree</strong> shows membership; <strong>Structure</strong> shows the OU hierarchy. Trace
            highlights one chain and dims everything else.
          </Term>
          <Term name="Pathfinder">
            Two questions. <em>How does an account reach a group?</em> lists every membership chain between them and
            names the links they share, so you know which single change breaks all of them. <em>Who is really in a
            group?</em> lists every account inside a group, direct or nested — the question an access review starts
            from, and the one a member list cannot answer.
          </Term>
          <Term name="Hygiene">
            Every finding, filtered by type, with the score. Click a row to jump to the objects involved.
          </Term>
          <Term name="Settings">
            Thresholds, connection defaults, report layout, privacy. Changing a hygiene threshold re-scores the open
            directory immediately, without reading the DC again.
          </Term>
        </dl>
      </>
    )
  },
  {
    id: 'nesting',
    title: 'Why nested groups are the problem',
    blurb: 'The AD behaviour every finding here comes back to.',
    keywords: 'nesting token effective membership primary group tiering acl',
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
        <h3>What SPYDR does about it</h3>
        <p>
          It reads the whole membership graph — every <code>member</code> link in the directory — and walks it. That is
          what Pathfinder enumerates, what the Web canvas draws, and what most of the hygiene rules examine. Effective
          membership becomes something you can look at rather than something you reason about.
        </p>
        <h3>The bit that is easy to miss</h3>
        <p>
          A user's <strong>primary group</strong> — usually Domain Users — is not stored as a membership at all. It is a
          RID on the account, and it appears in neither the group's member list nor the user's memberOf. SPYDR resolves
          it and draws it as a dashed link, so the graph matches the token a user actually gets.
        </p>
      </>
    )
  },
  {
    id: 'rules',
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
          works — a domain full of seasonal staff has a different idea of "stale" than one that does not.
        </p>
      </>
    )
  },
  {
    id: 'score',
    title: 'How the score works',
    blurb: 'What 58 out of 100 means, and what moves it.',
    keywords: 'hygiene score weighting severity penalty',
    body: (
      <>
        <p>
          Each finding carries a weight by severity: critical 12, high 6, medium 3, low 1. Those weights are summed into
          a penalty, and the score is <code>100 × 100 ÷ (100 + penalty)</code>.
        </p>
        <p>
          The curve saturates rather than subtracting. A linear penalty would hit zero on any real domain and stop
          telling you anything — every directory with a thousand stale accounts would score the same zero as one with
          ten thousand. This way the number always has somewhere further to fall, and closing anything always moves it
          up.
        </p>
        <p>
          Treat it as a direction of travel, not a grade. A large domain will score lower than a small one with the same
          discipline, simply because it has more objects to have findings about. What matters is whether your own number
          goes up between reads.
        </p>
      </>
    )
  },
  {
    id: 'reading',
    title: 'Reading a real directory',
    blurb: 'Paging, timeouts, and the attributes AD does not keep current.',
    keywords: 'maxpagesize ranged retrieval lastlogontimestamp replication timeout large domain',
    body: (
      <>
        <h3>Paging</h3>
        <p>
          Domain controllers cap how many entries one search returns — <code>MaxPageSize</code>, 1000 by default. SPYDR
          pages at 500 and stitches the pages together. If your DC enforces something smaller, lower the page size in
          Settings under Connection.
        </p>
        <h3>Large groups</h3>
        <p>
          A group with more than about 1500 members does not return them all at once; AD hands them back in ranges.
          SPYDR requests each range until the group is complete, so a group of 20,000 is read correctly — it just takes
          more round trips.
        </p>
        <h3>Last logon is approximate, by design</h3>
        <p>
          SPYDR reads <code>lastLogonTimestamp</code>, which replicates between DCs — but only when it changes by more
          than a replication window, by default 14 days. An account that logged on yesterday can legitimately show a
          timestamp up to two weeks old. Treat "stale" findings as a shortlist to confirm, not a verdict. The precise
          attribute, <code>lastLogon</code>, is not replicated at all and would have to be read from every DC to be
          meaningful.
        </p>
        <h3>Speed</h3>
        <p>
          Computers are often half the objects in a directory and hold no membership of their own beyond a primary
          group. Turning them off in Settings can halve a read on a large domain.
        </p>
      </>
    )
  },
  {
    id: 'reports',
    title: 'Reports',
    blurb: 'A PDF for people who will never open SPYDR.',
    keywords: 'pdf export report print paper a4 letter findings',
    body: (
      <>
        <p>
          <strong>File ▸ Generate Hygiene Report</strong>, or the button in Hygiene, writes a PDF of the current
          findings: a cover with the domain and score, an overview with the severity breakdown, a priorities section
          covering everything critical and high, one section per rule that fired, and an appendix recording exactly what
          was read and with which thresholds.
        </p>
        <p>
          It is designed to be handed to someone who will not open this app — a manager, an auditor, a change board.
          Every finding names the objects involved and the change SPYDR would suggest. Nothing in it has been applied:
          the app is read-only, and the report is a description, not a record of work done.
        </p>
        <p>Paper size, how many findings each section lists, and whether the PDF opens after saving are in Settings.</p>
      </>
    )
  },
  {
    id: 'privacy',
    title: 'Privacy and safety',
    blurb: 'What SPYDR reads, what it keeps, and what it never does.',
    keywords: 'security read-only password safestorage telemetry session consent encryption',
    body: (
      <>
        <h3>Read-only, structurally</h3>
        <p>
          SPYDR issues searches. It contains no add, modify, or delete operation against LDAP, so no bug or misclick can
          change your directory. Suggested fixes are text for you to carry out elsewhere.
        </p>
        <h3>Passwords</h3>
        <p>
          A bind password is held in memory by the main process for the session, so that Re-crawl can read again without
          asking. It is never sent to the interface, never written to the session file, and dropped when you disconnect
          or quit.
        </p>
        <h3>What lands on disk</h3>
        <p>
          Only if you agree to it. Restoring a session needs a copy of the snapshot on this machine — compressed, and
          encrypted with the OS keychain where one exists. SPYDR asks once, and declining removes anything already
          written. You can change the answer, or forget the saved session, in Settings under Privacy.
        </p>
        <h3>Nothing leaves the machine</h3>
        <p>
          No telemetry, no analytics, no crash reporting. The only network connection SPYDR opens is to the domain
          controller you name — and to an update feed, if you configure one, which is off by default.
        </p>
      </>
    )
  },
  {
    id: 'trouble',
    title: 'When a connection fails',
    blurb: 'What the common bind errors actually mean.',
    keywords: 'error troubleshooting certificate 49 invalid credentials timeout refused referral',
    body: (
      <>
        <dl className="kb-terms">
          <Term name="Invalid credentials (LDAP 49)">
            The bind was rejected. Check the account and password, and the format — <code>DOMAIN\\user</code> or a UPN.
            A correct password against the wrong domain name fails the same way. Repeated attempts can lock the account
            out, so confirm the credentials elsewhere before retrying.
          </Term>
          <Term name="Certificate errors on LDAPS">
            The DC is presenting a certificate this machine does not trust — usually an internal CA that is not in the
            local trust store. Install the CA certificate, or tick trust self-signed for that connection.
          </Term>
          <Term name="Connection refused, or a timeout">
            Nothing is listening where SPYDR looked. Check the port matches the protocol (636 for LDAPS, 389 for LDAP
            and StartTLS), that the host is a domain controller, and that a firewall is not in the way. Raise the
            connect timeout in Settings for a slow link.
          </Term>
          <Term name="Could not read defaultNamingContext">
            The bind worked but the rootDSE told SPYDR nothing useful, which usually means the host is not a domain
            controller. Enter a Base DN explicitly to read anyway.
          </Term>
          <Term name="Run SPYDR as the desktop app">
            The interface is running without its privileged half — it happens in a browser or a broken build. LDAP
            binding lives in the desktop application only.
          </Term>
        </dl>
      </>
    )
  },
  {
    id: 'shortcuts',
    title: 'Keyboard shortcuts',
    blurb: 'Everything with an accelerator, from the menus.',
    keywords: 'keys hotkeys accelerator command control',
    body: (
      <table className="kb-keys">
        <tbody>
          {shortcutRows().map((row) => (
            <tr key={`${row.section}:${row.label}`}>
              <td className="muted">{row.section}</td>
              <td>{row.label}</td>
              <td>
                <kbd>{keys(row.accelerator)}</kbd>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
]
