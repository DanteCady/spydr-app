# SPYDIR architecture

This describes how the desktop app is put together and where it meets the site. It assumes you have
read the README and know what the product does.

## The process model

SPYDIR is an Electron application with the usual three build targets, produced by
`electron.vite.config.ts`: main, preload and renderer.

**Main** is everything with a capability. It creates the window, owns the IPC surface, binds to
domain controllers, reads and writes the settings file, holds the licence, opens the timeline
database, prints the PDF report and talks to the licence server. Both `net.fetch` calls in the
product — activation and telemetry — are made here.

**The renderer** is React and nothing else. It draws the workspaces, holds the snapshot in memory,
runs the hygiene rules over it and lays out the graph. It has no filesystem, no sockets and no Node
integration. The window is created with `contextIsolation: true`, `nodeIntegration: false` and
`sandbox: true`, and a Content-Security-Policy is applied to the default session on startup.

The rule underneath all of it: **LDAP never happens in the renderer.** Nothing under `src/` imports
`ldapts` or constructs a client, and `scripts/assert-read-only.mjs` walks `electron/`, `shared/` and
`src/` on every `npm test` to confirm it — along with the stronger property that no `ldapts` client
anywhere calls anything but `bind`, `search`, `searchPaginated`, `startTLS`, `unbind` and
`isConnected`, and that nothing in the app reaches for a child process.

The CSP is the other half of that containment. In a packaged build it sets `connect-src 'none'`:
the renderer makes no network calls at all, so a script injected through directory data — every
name and description of which is attacker-written in a compromised domain — has the snapshot in
reach but nowhere to send it. Main also refuses navigation away from its own document, denies
window opens except for `http:` and `https:` URLs handed to the OS, cancels any download the page
starts, and denies every permission request.

## The IPC boundary

`electron/preload.ts` builds one object and exposes it as `window.spydir` through
`contextBridge.exposeInMainWorld`. Every entry on it is a named function wrapping one channel:

```ts
ingest: (input: ConnectionInput): Promise<DirectorySnapshot> => ipcRenderer.invoke('spydir:ingest', input),
```

There is no generic passthrough. Nothing on the bridge takes a channel name from the caller, so the
renderer can only reach handlers that someone added deliberately, and the set of things it can ask
for is readable in one file. `src/vite-env.d.ts` declares the same surface as `SpydirApi`, which is
what gives the renderer types for it.

Three kinds of call cross the boundary:

- `invoke`/`handle` for anything asynchronous, which is most of it.
- `sendSync`/`on` with `evt.returnValue` for the handful of answers needed before first paint —
  `settingsSync` so the window opens in the right theme rather than flashing the default, `chrome`
  so it knows whether to draw its own title bar, `canRefresh` and `updateState`.
- `send` from main to the renderer for state that changes without being asked: settings updated in
  another window, update download progress, menu commands.

Both listener-style entries (`onSettings`, `onUpdate`, `onMenuCommand`) return their own
unsubscribe, so a component can register one in an effect and clean up without reaching for
`ipcRenderer` itself.

Main validates what it is handed. `validConnection` checks the shape of a `ConnectionInput` before
anything is done with it, and `isHostish` bounds the domain given to `discoverDcs` — that string is
concatenated into an SRV lookup, so without a bound the renderer would have a general-purpose DNS
channel. `spydir:role` dispatches editing commands through an allowlist by name rather than looking
the method up on `webContents`, because looking it up would expose every method on it.

### One call, end to end

Connecting to a directory:

1. `src/workspaces/Connect.tsx` collects the fields and assembles a `ConnectionInput`. The password
   is React state in that component; it goes nowhere else in the renderer.
2. The form calls `ingestLdap` from `src/state.tsx`, which calls `window.spydir.ingest(input)`.
3. Preload forwards it to the `spydir:ingest` channel.
4. `electron/main.ts` handles it. `validConnection(input)` runs first; a shape it does not
   recognise is rejected before a socket is opened.
5. `ingestDirectory` in `electron/directory/ldapProvider.ts` binds, reads and returns an enriched
   snapshot. See the next section.
6. Main derives the session profile from the input with `toProfile`, which strips the password, and
   keeps the full input in the module-level `liveBind` so the directory can be re-read later. Both
   are memory only, in main only; neither is ever sent back over the bridge.
7. The snapshot is returned to the renderer, `applySnapshot` puts it into state, and `Gate` in
   `App.tsx` swaps the Connect screen for `AppShell`.

Re-crawling is the same journey with the credentials left out. `refresh()` takes no argument at all:
the renderer asks for another read, and main uses the `liveBind` it already holds. The renderer
never holds the password to ask with, and `canRefresh()` exists so the button can be enabled without
the renderer knowing anything more than whether main still has a bind.

## The `shared/` contract

`shared/` holds the logic that is not about processes: directory types, the settings shape and its
validation, the hygiene rule engine, the membership graph, snapshot diffing, the timeline entry
model, the telemetry payload, the report model, licence key normalisation and release-note parsing.

It lives there because the two sides must not disagree. `applyPatch` validating a settings patch in
the renderer and again in main is the same function, so an optimistic update cannot drift from what
gets written. `normalizeKey` in the app and on the server produce the same canonical string, so a
key pasted out of an email hashes to the one that was issued. `parseRelease` gives the app's guide
and the site's releases page one answer to "what does this file say" rather than two.

The parts of it that are pure — no Electron, no Node — are also what the site can import.

Four configurations wire up the `@shared` alias, and they must agree:

| Where | What sets it |
| --- | --- |
| The renderer build | `resolve.alias` in `electron.vite.config.ts` |
| Typechecking | `paths` in `tsconfig.json` and `tsconfig.node.json` |
| Tests | `resolve.alias` in `vitest.config.ts`, so a test can import a file under `src/` that uses it |
| The site | `paths` in `site/tsconfig.json`, mapping `@shared/*` to `../shared/*` and `@app-src/*` to `../src/*` |

Files under `electron/` import `shared/` by relative path instead; the alias is not used there.

The site reaching outside its own directory is the unusual part, and it takes two things.
`site/tsconfig.json` maps the aliases and adds `../src/help/**/*.tsx` to its `include`, and
`site/next.config.ts` sets `experimental: { externalDir: true }` so Next compiles those files where
they are rather than requiring a copy. A copy is the thing being avoided: it would be correct on the
day it was made and wrong shortly afterwards.

## A directory read

```
Connect ──▶ ingestDirectory ──▶ enrichSnapshot ──▶ DirectorySnapshot ──▶ renderer state
                (electron)         (shared)                                 (workspaces)
```

`ingestDirectory` binds with the protocol asked for — TLS options are attached only for `ldaps://`,
since `ldapts` reads their presence as "this socket is TLS" and would negotiate against a plaintext
port — then reads the rootDSE for `defaultNamingContext` and `dnsHostName`, so a blank base DN
resolves to the domain root rather than failing.

Five paged searches then run in parallel: users, groups, OUs, containers and computers. Containers
and computers are each optional, because computers can be half of a large directory and carry no
membership beyond a primary group. Group membership needs two extra passes that are easy to miss:

- **Ranged retrieval.** Active Directory returns at most 1500 members at a time, as
  `member;range=0-1499`. `readMembers` follows the ranges, requiring each one to advance strictly
  and capping the total, so a server that keeps answering with the same range cannot spin forever.
- **Primary group.** A user's primary group — usually Domain Users — is stored as a RID on the
  account and appears in neither `member` nor `memberOf`. It is resolved by matching that RID
  against each group's `objectSid` and added as an edge with `via: 'primaryGroup'`.

The result is a flat list of `DirectoryNode`s and `DirectoryEdge`s, which goes to `enrichSnapshot`
in `shared/enrich.ts`. That marks privileged groups, runs the rule engine, and returns a
`DirectorySnapshot`: nodes, edges, findings and a stats block including the hygiene score.

The engine in `shared/engine/` is a registry of eight rules, each a pure function from a prebuilt
context to findings. The context is computed once — the membership graph, group cycles, nesting
depth, the privileged set — because most rules need the same derived facts. The score is a
saturating curve rather than a subtraction, so it stays strictly monotonic and never bottoms out on
a real domain.

From there the snapshot is renderer state, and the workspaces are views over it. Directory reads the
DN hierarchy, Web and Pathfinder build a graphology graph from the same nodes and edges, Hygiene
lists the findings, Timeline reads the change history from main. Clicking a finding calls
`goToFinding`, which picks the workspace that can actually show that kind of problem and sets the
selection up before switching.

Because the engine is shared code, changing a hygiene threshold does not re-read the directory. The
provider watches the hygiene settings and calls `rescoreSnapshot` over the snapshot already in
memory. A threshold is a question about data you already have.

## Where state lives

**Main owns the settings; the renderer mirrors them.** `electron/settings.ts` reads
`settings.json` once at startup and holds it in memory. Main's own code — the ingest tuning, the
report writer, the retention sweep — reads it straight from there. The renderer takes a copy
synchronously on first paint and holds it in `AppProvider`.

A change from the renderer is applied locally first, so a control never lags a keystroke behind, and
sent to main as a patch. Main validates it, writes the file atomically and broadcasts the result to
every window; the renderer replaces its copy with whatever comes back. Main has the final word, and
two windows cannot end up disagreeing.

A corrupt or hand-edited settings file falls back to defaults rather than stopping the app, and
`normalizeSettings` clamps values instead of rejecting the file.

The **snapshot** lives only in the renderer. Main keeps the last read for diffing and the live bind
for re-crawling, both in memory, both dropped on disconnect or quit.

## What is written to disk

Everything lives under Electron's `userData` directory, which the About section prints.

| File | Holds | Protection |
| --- | --- | --- |
| `settings.json` | Every preference, plus the telemetry install identifier | Written atomically via a temp file, mode `0600` |
| `licence.json` | The signed activation payload and its signature | Mode `0600`. Verified with `resources/license-public.pem` on every read; an unverifiable file is not trusted |
| `session/last-session.bin` | The last snapshot and the view it was left in | Gzipped, then encrypted with `safeStorage` where the OS provides a keychain. Mode `0600`, written via a temp file |
| `session/last-session.json` | A small header — domain, controller, stats, profile, timestamp | Mode `0600`, re-applied on every write because `writeFileSync` only honours the mode when it creates the file |
| `timeline.db` | The change history | SQLite via `node:sqlite`, so there is no native module to rebuild per platform. Mode `0600` |

Two rules govern all of it.

**The bind password is never written.** `toProfile` strips it before anything reaches the session
file, and it is derived in main rather than accepted over IPC so the renderer is never trusted to do
the stripping. Error messages from the LDAP layer are scrubbed of anything password-shaped.

**A real directory is only stored with consent.** `shared/session.ts` holds that decision in one
function. The sample is never written at all, whatever consent says: there is exactly one session
slot, saving the sample would overwrite a real read along with the profile needed to reconnect, and
the sample costs nothing to rebuild from the fixture. Declining is retroactive — anything already
written is removed. The same consent governs the timeline.

The timeline splits its storage deliberately. Structure — when, which controller, which scope, how
many of what — is stored in the clear so entries can be listed and queried by index. Names,
distinguished names and the diff itself are encrypted the same way the session snapshot is. Object
GUIDs are indexed in the clear, because a GUID on its own says nothing about anybody.

## Two consumers, one source

Both the app and the site publish the same guide and the same release notes, and in both cases the
mechanism is chosen so that adding something registers it in both places at once.

**Guide articles.** `src/help/articles.tsx` exports every article as an object with an id, a
section, a title, a blurb and a React body. The app renders them in the Help workspace. The site
imports the same module through `site/lib/docs.ts` and generates one static page per article. There
is no list to update in either place, and no second copy of the words. A few articles use hooks and
one asks the desktop bridge for build information — on the web there is no bridge, and
`site/spydir.d.ts` declares the shape those components probe for so the compiler agrees.

**Release notes.** One Markdown file per version in `content/releases/`, with frontmatter and typed
bullets under category headings. `shared/releases.ts` parses them; both sides use that parser.
`src/releases.ts` picks the files up with `import.meta.glob` at build time, and
`site/lib/releaseNotes.ts` reads the same directory off disk. Adding a file is adding a release on
both, with no index anywhere that can be forgotten.

The parser refuses an unknown category rather than accepting it, because a typo would otherwise
create a section neither reader's filters know about. `npm test` checks the shipped notes against
`package.json`, so a version that appears in the About screen, the licence check, the telemetry
payload and the site's download cards has notes behind it.

## Tests

`npm test` runs `scripts/assert-read-only.mjs` and then vitest. The guard goes first because it
protects the one property nothing else would notice the loss of.

The suite is unit tests over `shared/` and the pure parts of `electron/`, in `tests/`. There is no
Electron harness and no browser-driven test: what is covered is the logic, and the logic is
deliberately where it can be covered.

| Area | Covers |
| --- | --- |
| `engine.test.ts` | Every rule in isolation, plus an exact comparison of the fixture's findings against `tests/golden/contoso-findings.json`, and the score's saturation and monotonicity |
| `parse.test.ts` | The LDAP attribute shapes `ldapts` returns: mixed-endian GUIDs, SIDs, FILETIME, generalized time, DN parsing, ranged member attributes |
| `connection.test.ts` | That TLS options are attached for `ldaps` only, and that the certificate choice reaches the client |
| `reach.test.ts` | Effective membership through nesting, and the links two paths depend on |
| `diff.test.ts`, `timeline.test.ts`, `timelineGraph.test.ts` | What a re-read reports as changed, what is worth recording, and how reads with incomparable scopes are separated into lanes |
| `rescore.test.ts`, `settings.test.ts` | That changing a threshold re-scores correctly, and that a settings file is clamped rather than rejected |
| `license.test.ts`, `otp.test.ts` | Key normalisation and grace behaviour, and the signup code's single-use, expiry and attempt limits |
| `telemetry.test.ts` | That a payload carries nothing identifying, that sizes are bucketed, and that unexpected keys are dropped |
| `report.test.ts`, `releases.test.ts`, `session.test.ts`, `tree.test.ts` | The report model, the release notes as shipped, the persistence decision, and which containers are hidden from the tree |

Two checks sit outside vitest. `npm run verify:fixture` ingests the sample forest and fails if any
rule has stopped firing on it, which stops the fixture quietly decaying into something that no
longer demonstrates the product. `npm run typecheck` covers both projects, and is the only thing
that typechecks the main process at all.

CI runs typecheck, the read-only guard, the tests and the fixture check on every push to `main` and
`develop` and on every pull request, then packages all three platforms unsigned. The release
workflow runs the same checks before a tag is allowed to publish anything.
