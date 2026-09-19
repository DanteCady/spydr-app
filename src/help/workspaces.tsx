import { Control, Term, type Article } from './kit'

export const WORKSPACES: Article[] = [
  {
    id: 'directory',
    section: 'Workspaces',
    title: 'Directory',
    blurb: 'The tree, the object list, and the inspector.',
    keywords: 'aduc tree ou container search inspector tabs expand collapse internals objects',
    body: (
      <>
        <p>
          The view that will feel familiar: an OU tree on the left, the contents of the selected container in the
          middle, and everything known about the selected object on the right. Start here when you know what you are
          looking for.
        </p>
        <h3>The tree</h3>
        <p>
          Organizational units and containers, nested as they are in the directory. Clicking a row both selects it and
          moves the list to its contents; clicking the chevron expands without moving. Icons carry meaning — see{' '}
          <em>Objects, icons and badges</em>.
        </p>
        <dl className="kb-terms">
          <Control name="Expand / Collapse">Opens or closes every branch at once. Useful before a visual scan.</Control>
          <Control name="AD internals">
            Reveals the containers Active Directory maintains for itself — <code>System</code>,{' '}
            <code>Program Data</code>, <code>NTDS Quotas</code>, <code>ForeignSecurityPrincipals</code> and the rest.
            They are hidden by default so the tree shows your structure rather than AD's plumbing. The button carries a
            count, and is disabled when a directory has none to show.
          </Control>
        </dl>
        <h3>The object list</h3>
        <p>
          Everything directly inside the selected container: name, type, description and status. Status badges are the
          fast scan — privileged groups, disabled accounts, accounts with no recent logon. Clicking a row selects it;
          clicking an OU also navigates into it.
        </p>
        <p>
          The search box in the header searches the <em>whole</em> directory rather than the open container, matching
          name, display name, SAM account name, UPN and description. The list header says so when a search is active.
        </p>
        <h3>The header row</h3>
        <p>
          On the right: how long ago the directory was read, the <strong>Re-crawl</strong> button, and the object
          count. A read from two hours ago is a fact worth knowing before you conclude that a change did not land.
        </p>
        <h3>The inspector</h3>
        <p>Six tabs, shown as they apply to the selected object:</p>
        <dl className="kb-terms">
          <Term name="General">Name, description, mail, office; group scope for groups, operating system for computers.</Term>
          <Term name="Account">
            UPN, SAM account name, last logon, and the account flags decoded from <code>userAccountControl</code> —
            disabled, password never expires, smartcard required, and so on. UPN and SAM have copy buttons.
          </Term>
          <Term name="Member Of">
            The groups this object is a direct member of. Each is a link: click to select it and keep walking.
          </Term>
          <Term name="Members">
            For a group, its direct members. An empty security group says so explicitly rather than showing a blank
            list, because "empty" is itself a finding.
          </Term>
          <Term name="Object">Distinguished name, object GUID, created and changed timestamps, each copyable.</Term>
          <Term name="SPYDR">
            What this application makes of the object: how many groups it reaches, every finding attached to it, and
            shortcuts into the Web canvas and Pathfinder.
          </Term>
        </dl>
      </>
    )
  },
  {
    id: 'web',
    section: 'Workspaces',
    title: 'Web canvas',
    blurb: 'The membership graph, drawn — and how to keep it readable.',
    keywords: 'graph canvas cytoscape tree structure trace minimap export png zoom density legend labels',
    body: (
      <>
        <p>
          Nesting that is unreadable as a list is obvious as a picture. The canvas draws the neighbourhood of whatever
          is selected, rather than the whole directory — a graph of ten thousand objects is a hairball that tells you
          nothing, so SPYDR shows you a focused view and lets you walk.
        </p>
        <h3>What you are looking at</h3>
        <p>
          Select a user or group and the canvas shows every group it reaches upward through nesting, plus two levels of
          members below it. Select an OU and it shows what the OU holds and the groups those objects reach. The caption
          under the title names the focus and counts what is drawn. Above roughly fifty objects the view trims, and says
          how many it left out — narrow the focus rather than fighting it.
        </p>
        <h3>The two layouts</h3>
        <dl className="kb-terms">
          <Control name="Tree">
            Membership. Edges run from member to group, bottom to top, so privilege accumulates upward and the groups
            at the top of the picture are the ones that matter.
          </Control>
          <Control name="Structure">
            The OU hierarchy, left to right, like a flow chart of the directory itself. This is the view for
            understanding how a domain is organised rather than who can do what.
          </Control>
        </dl>
        <h3>The controls</h3>
        <dl className="kb-terms">
          <Control name="Auto / Compact / Spread">
            Spacing. Compact fits more on screen; Spread separates crowded branches until the edges stop crossing.
            Auto picks from the size of what is drawn.
          </Control>
          <Control name="Grid">A background grid, for reading alignment when comparing branches.</Control>
          <Control name="Legend">The key: node colours by type, privileged and cycle markers, and the two edge kinds.</Control>
          <Control name="Names">
            Labels on or off. Off leaves icons only, which is how you see the shape of a large neighbourhood at a
            glance.
          </Control>
          <Control name="Trace">
            Pick a second object and SPYDR highlights the chain between them, dims everything else, and animates the
            edges along the direction of travel. This is the tool for showing someone else how an account reaches a
            group — and Pathfinder's "Trace on the canvas" drives exactly this.
          </Control>
          <Control name="Export">
            Writes the current view to PNG at twice screen resolution, named for the domain and the date. It is a
            picture of what is on screen, so hide names or spread the layout first if that is what you want to hand
            over.
          </Control>
          <Control name="Reset">Back to the default layout, spacing and zoom, without changing the selection.</Control>
        </dl>
        <h3>Moving around</h3>
        <p>
          Scroll to zoom, drag to pan, click a node to make it the new focus, click empty space to clear. Hovering a
          node shows a summary without changing anything. The minimap in the corner shows where you are in the drawing,
          and the zoom buttons include a fit-to-view.
        </p>
        <p>
          The navigator on the left is the same directory tree as the Directory workspace: it is there so you can jump
          the focus somewhere else without leaving the canvas.
        </p>
        <h3>Reading the edges</h3>
        <p>
          A solid line is a <code>member</code> link — an explicit membership someone created. A dashed line is a
          primary group, which exists only as a RID on the account and appears in no member list. Both grant access;
          only one is visible in ADUC.
        </p>
      </>
    )
  },
  {
    id: 'pathfinder',
    section: 'Workspaces',
    title: 'Pathfinder',
    blurb: 'How an account reaches a group, and who is really inside one.',
    keywords: 'paths chains nested access review effective members cut shared link revoke',
    body: (
      <>
        <p>
          Two questions, switched at the top of the page. Both are questions a member list cannot answer.
        </p>
        <h3>How does an account reach a group?</h3>
        <p>
          Pick an account and a target group. SPYDR walks every membership chain between them and leads with the answer
          in words — direct member, reaches it through nesting, or cannot reach it at all.
        </p>
        <p>
          Each route is drawn left to right with a <em>member of</em> label on every link, so the direction is not
          something you have to infer, and every object in the chain is clickable.
        </p>
        <h3>The cut analysis</h3>
        <p>
          When more than one route exists, SPYDR names the links they all share. This is the part that matters
          operationally: if an account reaches Domain Admins two ways, removing it from one group revokes nothing,
          because the other chain still arrives. A shared link is a single change that breaks every route at once.
        </p>
        <p>
          It is also the most common way offboarding quietly fails — the obvious membership is removed, the nested one
          is not, and the access survives the ticket that was supposed to end it.
        </p>
        <h3>Who is really in a group?</h3>
        <p>
          The access-review question. Pick a group and SPYDR lists every account inside it, direct or nested, deepest
          first — because the surprises are at the bottom. Each row shows how far away the account sits and the route
          it takes.
        </p>
        <p>
          The count at the top is the number that matters in a review: <em>four accounts end up in Domain Admins, three
          of which are not in its member list.</em> Nested groups themselves are left out of the count; this is the
          list of people who hold the access.
        </p>
        <h3>Trace on the canvas</h3>
        <p>
          Every route has a link through to the Web canvas with that chain highlighted and the rest of the graph dimmed.
          Use it when you need to show the shape of the problem to someone who does not read DNs for a living.
        </p>
      </>
    )
  },
  {
    id: 'hygiene',
    section: 'Workspaces',
    title: 'Hygiene',
    blurb: 'Every finding, the score, and the way into a report.',
    keywords: 'findings score filter chips severity table report cleanup triage',
    body: (
      <>
        <p>
          The list of everything the rules found, with the score across the top. This is the triage view: scan, filter,
          click through to the objects, and generate the report you hand to someone else.
        </p>
        <h3>The metrics</h3>
        <p>
          Hygiene score out of 100, total findings, criticals, cycles, and privileged nested paths. The last two have
          their own tiles because they are qualitatively different from the rest: a cycle means membership is
          genuinely unanswerable, and a nested path into a privileged group is access that an access review will miss.
        </p>
        <h3>Filtering</h3>
        <p>
          The chips filter by rule, each carrying its own count, so "show me only the stale accounts" is one click.
          Counts come from the current snapshot and change the moment a threshold changes in Settings.
        </p>
        <h3>The table</h3>
        <p>
          Severity, finding, and the detail that names the objects involved. Clicking a row takes you to the right
          place for that kind of finding: a nested path opens in Pathfinder with the source and target already set, a
          cycle or a deep chain opens on the Web canvas, and an object-level finding opens in Directory with the object
          selected. You land where you can act, not where the row was.
        </p>
        <h3>Reports</h3>
        <p>
          <strong>Generate PDF report</strong> writes the whole thing out as a designed document — see <em>Reports</em>.
          The status line afterwards names the file it wrote.
        </p>
        <h3>Changing what counts as a finding</h3>
        <p>
          Every rule can be turned off, and every threshold moved, in Settings. The directory in memory is re-scored
          immediately — no re-read, no rebind — so tuning is a conversation rather than a round trip.
        </p>
      </>
    )
  },
  {
    id: 'settings-guide',
    section: 'Workspaces',
    title: 'Settings',
    blurb: 'Every setting, and what changing it actually does.',
    keywords: 'preferences thresholds rules privileged groups page size timeout paper a4 theme canvas updates',
    body: (
      <>
        <p>
          Six sections, at <kbd>⌘,</kbd> or from the rail. Settings are stored as one file in the app's data folder;
          the About section names its exact path. A bad or hand-edited file cannot break the app — unknown keys are
          dropped and out-of-range numbers are clamped.
        </p>
        <h3>Hygiene rules</h3>
        <dl className="kb-terms">
          <Term name="Stale after">
            Days without a logon before an account counts as stale. Match it to how your organisation works — a domain
            full of seasonal staff has a different idea of stale than one that does not. Remember that the underlying
            attribute lags by up to two weeks.
          </Term>
          <Term name="Nesting limit">
            How many levels deep a group may be before it is flagged. Three is a defensible default; a directory built
            around a strict role model may legitimately run deeper.
          </Term>
          <Term name="Privileged paths">
            How many routes to enumerate per account and privileged group. Raising it finds more chains in a heavily
            nested domain at the cost of time.
          </Term>
          <Term name="Your privileged groups">
            The built-in four — Domain Admins, Enterprise Admins, Schema Admins, Administrators — are always treated as
            privileged. Add your own Tier-0 groups here, and the rules will treat paths into them as critical too. This
            is the single most valuable setting for a real domain, because your crown jewels are rarely named after
            Microsoft's defaults.
          </Term>
          <Term name="Rules">
            Each of the eight can be turned off. Turning one off removes its findings and raises the score, which is
            honest rather than flattering only if you turn it off for a reason.
          </Term>
        </dl>
        <h3>Connection</h3>
        <p>
          Defaults for the connect screen, and the limits the read runs under: LDAP page size, search and connect
          timeouts, and whether computers and system containers are read at all. Turning computers off can halve a read
          on a large domain — they are often half the objects and hold no membership beyond a primary group.
        </p>
        <h3>Reports</h3>
        <p>
          Letter or A4, how many findings each section lists before the rest are summarised as a count, the length of
          the priorities section, and whether the PDF opens once written.
        </p>
        <h3>Privacy &amp; session</h3>
        <p>
          Whether snapshots may be kept on this computer, whether to forget them on quit, and a button to forget the
          saved one now. Declining removes anything already written.
        </p>
        <h3>Appearance</h3>
        <p>
          Theme, and the state the Web canvas starts in — layout, spacing, names, legend, grid. Changes you make on the
          canvas itself apply to that visit only; these are the defaults it returns to.
        </p>
        <h3>About &amp; updates</h3>
        <p>
          Version and build information, where settings and data live, and update checking. SPYDR contacts nothing
          unless you give it a feed URL, and it never installs anything on its own — it tells you what exists and links
          to it.
        </p>
      </>
    )
  },
  {
    id: 'reports',
    section: 'Workspaces',
    title: 'Reports',
    blurb: 'A PDF for people who will never open SPYDR.',
    keywords: 'pdf export report print paper a4 letter findings audit handover',
    body: (
      <>
        <p>
          <strong>File ▸ Generate Hygiene Report</strong> (<kbd>⌘P</kbd>), or the button in Hygiene. SPYDR asks where to
          save, writes the PDF, and opens it.
        </p>
        <h3>What is in it</h3>
        <ol className="kb-steps">
          <li>
            <strong>A cover</strong> with the domain, the score in words as well as numbers, and the facts of the read —
            when, which controller, which protocol, bound as whom, and the scope.
          </li>
          <li>
            <strong>What SPYDR found</strong>: the score, the finding count, criticals and highs, objects read, and a
            severity breakdown.
          </li>
          <li>
            <strong>What to fix first</strong>: every critical and high finding, each naming the objects involved and
            the change SPYDR would suggest.
          </li>
          <li>
            <strong>One section per rule</strong> that fired, each introduced by what the rule looks for.
          </li>
          <li>
            <strong>Scope and method</strong>: exactly what was read and under which thresholds, so a reader in three
            months can tell whether a number is comparable.
          </li>
        </ol>
        <h3>Who it is for</h3>
        <p>
          Someone who will not open this application: a manager, an auditor, a change board. It is written to be read
          cold, without the app open beside it, which is why every finding names its objects instead of pointing at a
          screen.
        </p>
        <p>
          Nothing in it has been applied. SPYDR is read-only; the report describes a directory and proposes changes, it
          does not record work done.
        </p>
        <h3>Practicalities</h3>
        <p>
          The text is real text, not an image — searchable and selectable. Paper size, list lengths and open-after-save
          are in Settings. The typeface travels inside the file, so it renders identically on a machine that has never
          seen it.
        </p>
      </>
    )
  }
]
