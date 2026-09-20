# SPYDIR

A read-only Active Directory explorer. SPYDIR binds to a domain controller over LDAPS, reads the
directory into an in-memory snapshot, and then works offline against that copy: an OU tree, a group
membership graph, the paths by which an account reaches a privileged group, and a set of hygiene
findings with a score attached.

It is for the administrator who has inherited a domain nobody has tidied since the last migration,
and for the consultant who has been given credentials for an afternoon and needs something to hand
back at the end of it. SPYDIR performs no LDAP writes — it binds, searches and disconnects — which
is what makes it reasonable to point at a production domain controller. That property is enforced
by `scripts/assert-read-only.mjs` rather than by review, and the check runs before the tests.

SPYDIR is free and activated with a licence key. The key is issued by the site in `site/`, which is
both the marketing and documentation site and the licence server.

## Requirements

- **Node 22 or newer.** Both CI workflows pin Node 22, and the change timeline in the app and the
  licence store on the site are both built on `node:sqlite`, which Node ships from 22 onwards.
  Neither `package.json` declares an `engines` field, so nothing stops an older Node at install
  time — it fails later, when something opens a database.
- npm. Both projects commit a lockfile and CI installs with `npm ci`.
- Docker, only if you want the local AD lab in `lab/`.

## Getting started

This repository holds two separate npm projects that do not share a `node_modules`. The desktop app
is at the root; the site is in `site/`. Install each one where it lives.

The desktop app:

```bash
npm install
npm run dev
```

On a machine with no key the window opens on the activation screen; with one, on Connect. Either way
the sample directory is one click away — **Look around the sample directory first** on the
activation screen, **Open sample directory** on Connect. It loads the fixture forest in
`fixtures/contoso-lab.ts`, needs neither a licence key nor a domain controller, and is the fastest
way to see what the workspaces do. Binding to a real directory needs a key, which comes from the
site.

The site:

```bash
cd site
npm install
npm run dev     # http://localhost:4200
```

A development build of the app talks to `http://localhost:4200` for activation and telemetry rather
than to production, so running both together issues keys against the local database. See
`site/README.md` for the environment the licence server needs.

Before calling a change done, run `npm run typecheck` and `npm test`.

## Scripts

All of these are run from the repository root.

| Script | What it does | When you would run it |
| --- | --- | --- |
| `npm run dev` | `electron-vite dev`. Builds main and preload, starts the renderer on a dev server, opens the window. | Everyday development. Note that the renderer hot-reloads but main is built once at startup, so a new IPC handler needs a restart — `BridgeMismatch` in the renderer says so when it spots the gap. |
| `npm run build` | Builds main, preload and renderer into `out/`. | Before packaging, or to check the production build works. |
| `npm run preview` | Runs the built output rather than the dev server. | Checking behaviour that differs between dev and production, such as the stricter CSP. |
| `npm run typecheck` | `tsc --noEmit` over both projects: `tsconfig.json` covers `src`, `shared` and `fixtures`; `tsconfig.node.json` covers `electron`, `shared`, `fixtures` and the Vite config. | Before every commit. Nothing else typechecks the main process. |
| `npm test` | Runs the read-only guard, then `vitest run`. | Before every commit, and in CI. |
| `npm run verify:readonly` | The read-only guard on its own: no non-read method on an `ldapts` client, no child process anywhere in `electron/`, `shared/` or `src/`. | When you have touched the LDAP layer and want the answer without waiting for the suite. |
| `npm run verify:fixture` | Ingests the sample forest and prints its stats and findings, failing if any of the eight rules has stopped firing on it. | After changing a rule, the engine, or the fixture. |
| `npm run lab:up` | Builds and starts a Samba domain controller in Docker. First provision takes about a minute. | Testing against a real LDAP server rather than the fixture. |
| `npm run lab:seed` | Creates the Harborview Logistics directory inside it — OUs, people, groups, nesting and deliberate mess. Safe to re-run. | Once after `lab:up`. |
| `npm run lab:verify` | Ingests the lab through SPYDIR's own LDAP provider and prints the findings and hygiene score. | Confirming the provider still reads a real DC correctly. |
| `npm run lab:logs` | Follows the domain controller's log. | When a bind fails and the app's error is not enough. |
| `npm run lab:down` | Stops the container, keeping its data. | Done for the day. |
| `npm run lab:reset` | Stops the container and deletes its volumes. | Starting the lab over from nothing. |
| `npm run package` | Builds, then runs electron-builder for the current platform. Output lands in `release/`. | Producing an installer locally. Nothing is published. |
| `npm run package:mac` | dmg and zip, arm64 and x64. | As above, for macOS specifically. |
| `npm run package:win` | NSIS installer, x64 and arm64. Cross-building this from macOS needs Wine; CI uses a Windows runner instead. | As above, for Windows. |
| `npm run package:linux` | AppImage and deb. | As above, for Linux. |
| `npm run version:bump <patch\|minor\|major\|x.y.z>` | Writes the new version into `package.json` and creates an empty `content/releases/<version>.md` for the notes. | The first step of a release. `npm test` fails until those notes are written, which is deliberate. |

The site has its own scripts, run from `site/`.

| Script | What it does |
| --- | --- |
| `npm run dev` | Next dev server on port 4200. |
| `npm run build` | Production build. Reads `content/releases/` off disk and the app's guide components from `src/help/`, so both must be present. |
| `npm start` | Serves the production build on port 4200. |
| `npm run lint` | `next lint`. |
| `npm run keygen` | Generates the Ed25519 pair that signs activations. The private half goes in `LICENSE_PRIVATE_KEY`, the public half in `resources/license-public.pem`. |
| `npm run keys:seed` | Creates the reserved developer and beta keys, if they do not already exist. Needs `KEYS_PASSPHRASE`. |
| `npm run keys:read` | Prints those reserved keys. Needs `KEYS_PASSPHRASE`. |

## Repository layout

| Path | What lives there |
| --- | --- |
| `electron/` | The main process. Window creation and the whole IPC surface in `main.ts`, the contextBridge in `preload.ts`, LDAP and DC discovery in `directory/`, and the things that own a file on disk: `settings.ts`, `license.ts`, `timeline.ts`, `report/`. Every network call the product makes starts here. |
| `src/` | The renderer: React, and nothing else. `App.tsx` decides which of activation, connect and the shell is on screen, `state.tsx` holds the one provider everything reads from, `workspaces/` holds the screens, `help/` holds the in-app guide. |
| `shared/` | Code both processes need and neither owns — types, settings shape and validation, the hygiene rule engine, the membership graph, snapshot diffing, the report model, release-note parsing. It is pure logic, which is what lets the site import parts of it directly. |
| `site/` | The Next.js site: landing page, documentation, release notes, and the licence API that issues, recovers and signs keys. A separate npm project with its own `README.md`. |
| `content/releases/` | One Markdown file per version, written by hand. The app globs them at build time and the site reads them off disk; adding a file is adding a release on both. |
| `fixtures/` | `contoso-lab.ts`, the sample forest behind **Open sample directory**. Built to make every rule fire, which is what `verify:fixture` checks. |
| `tests/` | The vitest suite, plus `golden/contoso-findings.json` — the findings the engine is expected to produce from the fixture, compared exactly. |
| `scripts/` | `assert-read-only.mjs`, the guard described above, and `version.mjs`, the release bump. |
| `docs/` | Developer documentation that is not user-facing. User-facing help lives in `src/help/` and is published to the site. |
| `resources/` | Files that ship alongside the build rather than inside it: application icons, the three IBM Plex faces the PDF report embeds, and `license-public.pem`, the public half of the signing key. Without that key the app cannot tell a real activation from an edited one and refuses to trust any stored licence, which is why it is the one `.pem` git does not ignore. |
| `lab/` | A throwaway Samba Active Directory domain controller in Docker, with a seeding script that builds a plausibly messy mid-size domain. Its own `README.md` has the connection details. |
| `build/` | macOS entitlements for the packaged app. |
| `public/` | Static files served with the renderer. |

`out/` and `release/` are build output and are ignored by git.

## The other documents

| Document | Answers |
| --- | --- |
| `docs/ARCHITECTURE.md` | How the pieces fit: the process split, the IPC boundary, what `shared/` is for, how a directory read travels from Connect to the workspaces, what is written to disk and where. |
| `docs/LICENSING.md` | Keys, the signup flow, activation, grace, and telemetry. |
| `docs/RELEASING.md` | How to cut a release: versioning, release notes, code signing, what a tag produces, and how installed copies update. |
| `site/README.md` | How the site works: the documentation import, the licence API routes, the environment the server refuses to start without, and deployment. |
| `lab/README.md` | How to run the local domain controller, what the seed script creates, and what SPYDIR should find in it. |
| `AGENTS.md` | Working conventions: the git flow, which subagent to reach for, and the rules that do not change. |
