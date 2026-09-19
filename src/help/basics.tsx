import { BuildInfo, Term, type Article } from './kit'

export const BASICS: Article[] = [
  {
    id: 'about',
    section: 'Start here',
    title: 'About SPYDR',
    blurb: 'What it is, who it is for, and what it refuses to do.',
    keywords: 'about version build licence purpose philosophy read-only',
    body: (
      <>
        <p>
          SPYDR is a read-only explorer for on-premises Active Directory. It reads a domain once, holds it in memory,
          and answers the questions the built-in tools leave open: who is really in this group, how did they get there,
          and what in this directory has quietly stopped making sense.
        </p>
        <h3>The problem it exists for</h3>
        <p>
          A directory that has been running for a decade accumulates structure nobody planned. Groups nested inside
          groups by three different admins for three forgotten reasons. Accounts disabled but never stripped of their
          memberships. A mail distribution list that somehow grants file access. None of it is visible in a member
          list, because a member list shows one level of a structure that is many levels deep.
        </p>
        <p>
          Active Directory Users and Computers is excellent at showing you one object. It is not built to show you the
          shape of the whole thing, and that shape is where the risk lives.
        </p>
        <h3>Three principles</h3>
        <dl className="kb-terms">
          <Term name="It never writes">
            There is no add, modify, or delete operation against LDAP anywhere in this application. Not gated behind a
            confirmation, not disabled by a flag — absent. You can run it against production during business hours
            without a change record, because nothing it does is a change.
          </Term>
          <Term name="It explains itself">
            A finding that says "deep nesting detected" and stops is a puzzle, not a tool. Every finding names the
            objects involved, the chain that produced it, and the change that would resolve it. Suggested fixes are
            text for you to carry out deliberately, elsewhere.
          </Term>
          <Term name="It stays on your machine">
            No telemetry, no analytics, no crash reporting, no account. The only connection it opens is to the domain
            controller you name. What it learns about your directory goes nowhere.
          </Term>
        </dl>
        <h3>Who it is for</h3>
        <p>
          Administrators who inherited a directory, teams preparing for an access review or an audit, and anyone who
          has been asked "why does this person have admin?" and found the answer takes an afternoon.
        </p>
        <h3>This build</h3>
        <BuildInfo />
      </>
    )
  },
  {
    id: 'start',
    section: 'Start here',
    title: 'Getting started',
    blurb: 'Open the sample, or bind to a domain controller.',
    keywords: 'connect bind ldaps credentials base dn rootdse sample restore first run',
    body: (
      <>
        <p>
          SPYDR reads a directory once, into memory, and everything after that happens locally. Closing the app or
          disconnecting throws the copy away.
        </p>
        <h3>Two ways in</h3>
        <p>
          <strong>Open sample directory</strong> loads a small fictional domain with the problems SPYDR looks for
          already in it: a nesting cycle, two paths into Domain Admins, stale and disabled accounts still holding
          memberships. Nothing is read from your network. It is the fastest way to learn what the views mean before
          pointing them at something real.
        </p>
        <p>
          <strong>Connect to a domain</strong> binds to a real domain controller. Bind as an ordinary domain user —
          reading the directory needs no privilege, and SPYDR asks for none. Binding as Domain Admin out of habit gives
          a read-only tool credentials it has no use for.
        </p>
        <h3>What happens on a first run</h3>
        <p>
          On Windows, SPYDR reads the domain and computer name from the environment and prefills them. Everywhere else
          you type the domain, and DNS SRV lookup finds a controller. <strong>Test</strong> binds, reads the rootDSE
          and disconnects — it proves the credentials and the transport without reading anything. <strong>Read
          directory</strong> does the full ingest.
        </p>
        <p>
          The first time a live directory is open, SPYDR asks once whether it may keep a copy on this computer for
          session restore. Declining costs you nothing but the restore.
        </p>
      </>
    )
  },
  {
    id: 'connecting',
    section: 'Start here',
    title: 'Connecting in depth',
    blurb: 'Every field on the connect screen, and what the ingest actually does.',
    keywords: 'ldaps starttls port 636 389 discovery srv base dn certificate ingest pipeline',
    body: (
      <>
        <h3>The fields</h3>
        <dl className="kb-terms">
          <Term name="Domain FQDN">
            Your domain's DNS name, such as <code>corp.example.com</code>. Given this, <strong>Find DCs</strong> queries{' '}
            <code>_ldap._tcp.dc._msdcs.&lt;domain&gt;</code> and lists the controllers DNS knows about, in priority
            order. Useful when you do not know or care which replica you read.
          </Term>
          <Term name="Domain controller">
            A specific DC by hostname or IP. Fill this in when DNS discovery fails, when you are reaching a domain
            across a trust, or when you deliberately want one replica — a DC in your own site answers faster, and a
            DC that has not replicated recently will give you yesterday's directory.
          </Term>
          <Term name="Protocol and port">
            <strong>LDAPS</strong> on 636 is TLS from the first byte, and the right default.{' '}
            <strong>StartTLS</strong> on 389 opens in the clear and upgrades the same socket — equally encrypted once
            established, and the option to use when a DC has no LDAPS listener. <strong>LDAP</strong> on 389 never
            encrypts: your bind password and the entire directory cross the network in the open. It exists for lab
            work and for diagnosing a broken TLS setup. Changing the protocol moves the port with it.
          </Term>
          <Term name="Bind as">
            <code>DOMAIN\\user</code> or a UPN such as <code>user@corp.example.com</code>. Both work. A wrong domain
            prefix fails identically to a wrong password, so check the prefix before retrying — repeated attempts lock
            accounts out.
          </Term>
          <Term name="Base DN (blank = rootDSE)">
            Where to start reading. Left blank, SPYDR asks the DC for its <code>defaultNamingContext</code> and reads
            the whole domain, which is almost always what you want. Set it to an OU to read only that subtree — faster
            on a very large directory, but be aware of what you lose: a user inside the subtree who is a member of a
            group outside it will show that membership, while the group itself will be missing, and rules that walk
            nesting will see a truncated graph.
          </Term>
          <Term name="Trust self-signed certificate">
            Accepts a DC certificate this machine does not trust, which is the normal state when an internal CA has not
            been distributed. It disables verification for that connection only. Against production, installing the CA
            certificate is the better answer.
          </Term>
        </dl>
        <h3>What the ingest does, in order</h3>
        <p>
          Worth knowing, because it explains both the timing and what SPYDR can and cannot see.
        </p>
        <ol className="kb-steps">
          <li>
            Bind, then read the rootDSE for <code>defaultNamingContext</code> and <code>dnsHostName</code> — the domain
            to read and the controller answering.
          </li>
          <li>
            Five paged subtree searches run in parallel: users, groups, organizational units, containers, computers.
            Each pages at 500 entries by default, and only the attributes SPYDR uses are requested.
          </li>
          <li>
            Objects are deduplicated by distinguished name and turned into nodes, keyed by <code>objectGUID</code> so
            that a rename between reads is a change to one object rather than a delete and an add.
          </li>
          <li>
            Every group's membership is read, including large groups that AD returns in ranges of about 1500 at a time.
            Each <code>member</code> link becomes an edge.
          </li>
          <li>
            Primary group membership is resolved from each account's <code>primaryGroupID</code> RID against the groups
            just read, and added as its own kind of edge — this is the only way Domain Users membership is visible at
            all.
          </li>
          <li>
            The rules run over the resulting graph, the score is computed, and the snapshot is handed to the interface.
          </li>
        </ol>
        <p>
          Nothing is cached between runs. Every read is a fresh one, which is why the timestamp in the header matters
          and why <strong>Re-crawl</strong> exists.
        </p>
      </>
    )
  },
  {
    id: 'sessions',
    section: 'Operating',
    title: 'Sessions and restoring',
    blurb: 'What survives a restart, and what deliberately does not.',
    keywords: 'restore session safestorage keychain consent forget disconnect encrypted',
    body: (
      <>
        <p>
          A read of a large directory is not instant, and being thrown back to a blank connect screen because you
          quit the app is a poor trade. SPYDR can keep the snapshot so the next run reopens where you left off.
        </p>
        <h3>What is kept</h3>
        <p>
          The objects, the memberships, the findings, and where you were — workspace, selection, open container. It is
          compressed, and encrypted with the operating system keychain where one is available, under the app's data
          folder.
        </p>
        <h3>What is not</h3>
        <p>
          The bind password. It lives in memory in the main process for the session and is dropped on disconnect and on
          quit. This is why <strong>Re-crawl</strong> is disabled after a restore: the snapshot came back, the
          credentials did not, and SPYDR will not store them to make the button work.
        </p>
        <h3>Your choice, and changing it</h3>
        <p>
          SPYDR asks once, the first time a live directory is open. Declining removes anything already written. Both
          the answer and a <strong>Forget now</strong> button live in Settings under Privacy, along with a{' '}
          <strong>forget on quit</strong> option for shared machines — restore within a run, nothing left behind after
          it.
        </p>
        <p>The sample directory carries nobody's data and is always restorable.</p>
      </>
    )
  },
  {
    id: 'recrawl',
    section: 'Operating',
    title: 'Re-crawl and what changed',
    blurb: 'Reading again, and reading the difference.',
    keywords: 'refresh recrawl diff changes updated stale snapshot compare',
    body: (
      <>
        <p>
          A snapshot is a photograph. Make a change in ADUC and SPYDR will keep showing you the directory as it was
          when you read it — the header says how long ago that was, for exactly this reason.
        </p>
        <p>
          <strong>Re-crawl</strong>, in the Directory header, reads the same directory again using the credentials the
          main process is still holding. You are not asked for the password again, and it is not stored anywhere to
          make that possible — it is simply still in memory from the bind.
        </p>
        <h3>It tells you what moved</h3>
        <p>
          Rather than silently replacing the view, a re-crawl compares the two reads and reports the difference:
          objects added and removed, memberships added and removed, how the finding count and the score moved. If
          nothing changed, it says so — which is itself the answer when you are checking whether a change replicated.
        </p>
        <p>
          Your place in the directory is kept across the re-read. The tree stays where it was, and the object you had
          selected stays selected if it still exists.
        </p>
        <h3>When it is unavailable</h3>
        <p>
          Greyed out on the sample, which is a fixture and never changes, and after a session restore, where the
          snapshot survived but the credentials did not. Connect again and it returns.
        </p>
        <h3>Replication, again</h3>
        <p>
          A re-crawl reads one domain controller. If you changed a membership on a different DC moments ago, the change
          may not have replicated yet. Nothing is wrong — read the DC you changed, or wait.
        </p>
      </>
    )
  }
]
