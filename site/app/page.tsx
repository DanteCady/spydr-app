import Image from 'next/image'
import Link from 'next/link'
import { Downloads } from '@/components/Downloads'
import { HeroGraph } from '@/components/HeroGraph'
import { Subscribe } from '@/components/Subscribe'

const SHOTS = {
  pathfinder: { src: '/assets/pathfinder.png', w: 1844, h: 960 },
  canvas: { src: '/assets/canvas.png', w: 1844, h: 1160 },
  timeline: { src: '/assets/timeline.png', w: 1844, h: 1160 },
  hygiene: { src: '/assets/hygiene.png', w: 1844, h: 1032 }
}

function Marker({ n, label }: { n: string; label: string }) {
  return (
    <div className="marker">
      <span className="mono">{n}</span>
      <span className="rule" />
      <span className="mono">{label}</span>
    </div>
  )
}

export default function Home() {
  return (
    <main id="top">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">Read-only Active Directory explorer</p>
          <h1>
            Your member list
            <br />
            is lying to you.
          </h1>
          <p className="lede">
            Not deliberately. It only shows one level of a structure that is many levels deep. SPYDR reads the whole
            membership graph and tells you who is <em>actually</em> inside a group, how they got there, and which single
            change would take them out.
          </p>
          <div className="cta">
            <Link className="btn" href="#downloads">
              Download for macOS, Windows, Linux
            </Link>
            <Link className="btn ghost" href="#inside">
              See what it looks like
            </Link>
          </div>
          <p className="fineprint">
            Free · Licence key, no account · Binds as an ordinary domain user · Never writes to your directory
          </p>
          <Subscribe />
        </div>
        <HeroGraph />
      </section>

      <section id="problem" className="band">
        <Marker n="01" label="The problem" />
        <div className="two-col">
          <div>
            <h2>A decade of “just nest it in there for now”.</h2>
            <p>
              Every directory accumulates structure nobody planned. A role group inside a resource group inside another
              role group, added by three different admins for three forgotten reasons. Accounts disabled but never
              stripped of their memberships. A mail distribution list that somehow grants file access.
            </p>
            <p>
              Active Directory Users and Computers is excellent at showing you one object. It was never built to show
              you the shape of the whole thing — and the shape is where the risk lives.
            </p>
          </div>
          <div className="compare">
            <div className="compare-col">
              <p className="mono label">ADUC · Domain Admins · Members</p>
              <ul className="rows">
                <li>Eve Walsh</li>
                <li className="dim">— that&rsquo;s the list —</li>
              </ul>
            </div>
            <div className="compare-col accent">
              <p className="mono label">SPYDR · who is really inside</p>
              <ul className="rows">
                <li>
                  Eve Walsh <span className="tag">direct</span>
                </li>
                <li>
                  Alice Chen <span className="tag deep">3 deep</span>
                </li>
                <li>
                  James Brooks <span className="tag deep">3 deep</span>
                </li>
                <li>
                  Frank Lee <span className="tag deep">4 deep</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="inside" className="band">
        <Marker n="02" label="Inside SPYDR" />

        <article className="feature">
          <div className="feature-text">
            <h3>Every route in, and the one link they share</h3>
            <p>
              Pathfinder walks every membership chain between an account and a group. When more than one exists it names
              the links they all pass through — because removing someone from one group revokes nothing if a second
              chain still arrives. That is how offboarding quietly fails.
            </p>
            <p className="mono note">Pathfinder · contoso.lab</p>
          </div>
          <Image
            src={SHOTS.pathfinder.src}
            width={SHOTS.pathfinder.w}
            height={SHOTS.pathfinder.h}
            alt="Pathfinder showing two routes from Alice Chen to Domain Admins and the two links both routes share"
            priority
          />
        </article>

        <article className="feature reverse">
          <div className="feature-text">
            <h3>Nesting you can look at instead of reason about</h3>
            <p>
              The canvas draws the neighbourhood of whatever you select — never the whole directory, which is a hairball
              that tells you nothing. Trace a chain and everything else dims, which is how you show a change board what
              you found without reading them a list of distinguished names.
            </p>
            <p className="mono note">Web · trace highlighting</p>
          </div>
          <Image
            src={SHOTS.canvas.src}
            width={SHOTS.canvas.w}
            height={SHOTS.canvas.h}
            alt="The membership graph with one chain highlighted and the rest of the graph dimmed"
          />
        </article>

        <article className="feature">
          <div className="feature-text">
            <h3>What changed since you last looked</h3>
            <p>
              Read the directory again and SPYDR records the difference: objects added and removed, memberships gained
              and lost with both ends named, findings opened and closed, and where the score went. Reads that change
              nothing leave no trace.
            </p>
            <p>
              It is not an audit log and never pretends to be — it cannot say who made a change. It says what moved, in
              words you can hand to someone else.
            </p>
            <p className="mono note">Timeline · one lane per domain and scope</p>
          </div>
          <Image
            src={SHOTS.timeline.src}
            width={SHOTS.timeline.w}
            height={SHOTS.timeline.h}
            alt="The timeline graph showing six reads, with findings opened and closed and the score moving"
          />
        </article>

        <article className="feature reverse">
          <div className="feature-text">
            <h3>Eight rules, and a score that is honest about itself</h3>
            <p>
              Circular nesting, chains too deep to audit, disabled accounts still holding memberships, distribution
              groups nested where they grant access, nested paths into privileged groups. Each rule says what it looks
              for, why it matters, and can be turned off if it does not fit your environment.
            </p>
            <p className="mono note">Hygiene · contoso.lab scored 58 of 100</p>
          </div>
          <Image
            src={SHOTS.hygiene.src}
            width={SHOTS.hygiene.w}
            height={SHOTS.hygiene.h}
            alt="The hygiene workspace listing findings by severity with the score"
          />
        </article>
      </section>

      <section className="band tight">
        <Marker n="03" label="Specification" />
        <dl className="spec">
          <div>
            <dt>Reads</dt>
            <dd>
              users, groups, organizational units, computers, containers, and every <span className="mono">member</span>{' '}
              link between them
            </dd>
          </div>
          <div>
            <dt>Writes</dt>
            <dd>nothing — there is no add, modify or delete operation against LDAP anywhere in the application</dd>
          </div>
          <div>
            <dt>Binds as</dt>
            <dd>an ordinary domain user. Reading needs no privilege and SPYDR asks for none</dd>
          </div>
          <div>
            <dt>Transport</dt>
            <dd>LDAPS, StartTLS, or plain LDAP for lab work</dd>
          </div>
          <div>
            <dt>Handles</dt>
            <dd>paged searches, ranged retrieval for groups over ~1500 members, primary-group RIDs that appear in no member list</dd>
          </div>
          <div>
            <dt>Stores</dt>
            <dd>settings; and — only if you agree — an encrypted snapshot and change history, on your machine</dd>
          </div>
          <div>
            <dt>Network</dt>
            <dd>
              the domain controller you name, and a licence check on first run that repeats monthly. No analytics, no
              account, and telemetry only if you switch it on
            </dd>
          </div>
          <div>
            <dt>Runs on</dt>
            <dd>macOS 13+ (Apple silicon and Intel), Windows 10+, Linux (AppImage)</dd>
          </div>
          <div>
            <dt>Exports</dt>
            <dd>a designed PDF report, and the canvas as PNG</dd>
          </div>
        </dl>
      </section>

      <section id="limits" className="band">
        <Marker n="04" label="What it does not do" />
        <div className="two-col">
          <div>
            <h2>The boundary, stated plainly.</h2>
            <p>
              SPYDR reads group membership and account state. That covers most of what goes wrong in a directory, and it
              is not everything. A clean score means membership is tidy — not that a domain is secure.
            </p>
            <p>If a page will not tell you what a tool cannot do, be careful with the rest of what it tells you.</p>
            <p>
              <Link className="linkish" href="/docs/limits">
                The full boundary, in the docs →
              </Link>
            </p>
          </div>
          <ul className="nots">
            <li>
              <span className="mono">ACLs</span> An account with GenericAll over an OU looks like an ordinary user here.
              Directory permission analysis is a different discipline.
            </li>
            <li>
              <span className="mono">Delegation</span> Constrained, unconstrained and resource-based delegation are real
              escalation paths and are invisible to SPYDR.
            </li>
            <li>
              <span className="mono">Group Policy</span> What a GPO grants, and where it is linked, is outside what
              SPYDR reads.
            </li>
            <li>
              <span className="mono">Resources</span> It can tell you forty people are inside a group. It cannot tell
              you what that group opens.
            </li>
            <li>
              <span className="mono">Scope</span> One domain per read, from one controller. No trusts, no sIDHistory, no
              Entra ID.
            </li>
            <li>
              <span className="mono">History</span> It compares reads. It cannot tell you who made a change, or when —
              your event log can.
            </li>
          </ul>
        </div>
      </section>

      <section id="downloads" className="band">
        <Marker n="05" label="Download" />
        <Downloads />
      </section>
    </main>
  )
}
