# SPYDIR

Read-only Active Directory explorer for messy on-prem directories. Electron + React + TypeScript,
with a Next.js site in `site/` that is both the marketing pages and the licence server.

Product name is **SPYDIR**. The repo folder is `spyder` and the GitHub remote is `spydr-app`, both
predating the rename; neither is worth churning.

## Run

```bash
npm install
npm run dev            # the desktop app
cd site && npm run dev # the site and licence server, on :4200
```

`npm run typecheck`, `npm test` and `npm run verify:fixture` before calling work done. `npm test`
runs the read-only guard first, then the suite.

## Architecture

- **LDAP, DC discovery, snapshots, findings, paths** live in `electron/`. Never bind or search from
  the renderer.
- **UI** lives in `src/`. Workspaces: Directory, Web, Pathfinder, Hygiene, Timeline, plus Settings
  and the guide, which are reachable without a directory open.
- **Sample forest** lives in `fixtures/contoso-lab.ts`. **Open sample directory** always works, with
  no licence key, and is never written to the session slot — it would overwrite a real read.
- **Settings** are one object: shape and validation in `shared/settings.ts`, the file and IPC in
  `electron/settings.ts`. Main owns it; the renderer mirrors it. Changing a hygiene threshold
  re-scores the open snapshot in the renderer rather than re-reading the DC.
- **Shared, pure logic** lives in `shared/`, which both the app and the site import — the site
  aliases `@shared` and uses `externalDir`. Anything both sides must agree on belongs there, and
  `normalizeKey` is the reason why: if the two sides disagreed about the canonical form of a key,
  activation would fail for inputs neither side thought were unusual.
- **The guide** in `src/help/` is the single source for both in-app help and the site's `/docs`.
  **Release notes** in `content/releases/` are the single source for both What's new and
  `/releases`. Neither has an index to register a new file in.
- v1 is **read-only**. No LDAP add/modify/delete. Suggested fixes are text only, and
  `scripts/assert-read-only.mjs` fails the build if that stops being true.
- Passwords: memory for the session, held only in main, never written to snapshots, session files,
  logs or error strings.

## Connect

Admins bind with UPN or `DOMAIN\user`. Prefill from Windows env when present; otherwise domain FQDN
→ DNS SRV, or a pasted DC host/IP. LDAPS preferred; LDAP and StartTLS exist for shops without
certs. Demo path is **Open sample directory**.

## Versioning and releases

The version is written once, in `package.json`. Everything else reads it from there.

```bash
npm run version:bump patch|minor|major|0.4.2
```

That bumps it and creates `content/releases/<version>.md` for the notes. `npm test` fails if the
version and the newest notes disagree, or if a stub was never filled in. Tagging `v<version>` is
what publishes: `release.yml` builds all three platforms and uploads the installers with the
manifests `electron-updater` reads.

See `docs/RELEASING.md`.

## Documentation

| File | Answers |
| --- | --- |
| `README.md` | What this is, how to run it, what every script does |
| `docs/ARCHITECTURE.md` | Process model, the IPC boundary, where state lives |
| `docs/SECURITY.md` | Threat model and every control, with its limitations |
| `docs/LICENSING.md` | Keys, the signup flow, activation, grace, telemetry |
| `docs/DEPLOYMENT.md` | Standing the licence server up on Lightsail |
| `docs/RELEASING.md` | Versioning, release notes, packaging, updating |
| `docs/ROADMAP.md` | What stands between v1 and selling it, and in what order |
| `site/README.md` | The site's own environment and endpoints |

User-facing documentation is not in this list: it lives in `src/help/` and is published to the site.

## Delegate

Use project subagents instead of improvising parallel patterns:

| Work | Subagent |
| --- | --- |
| Feature ideas, roadmap, scope, creep checks | `product-scope` (read-only; does not implement) |
| Connect, ldapts, ingest, fixture, DC discovery | `ad-ldap` |
| Directory / Web / Pathfinder / Hygiene / inspector | `spydir-ui` |
| graphology, cycles, paths, finding detectors | `graph-findings` |
| Password handling, TLS toggle, snapshot leakage, write attempts | `ad-security` |

Skills: `connect-onprem-ad`, `ad-hygiene-findings`.

## Git flow

- `develop` is integration and stays ahead of `main`. Branch `feature/<short-slug>` or
  `fix/<short-slug>` from `develop` — one product-scope item per branch.
- Commit on the branch. Merge with `git merge --no-ff` into `develop`. Check
  `git branch --show-current` before committing; landing on `develop` by accident is easy and not
  worth rewriting published history to undo.
- `main` is stable/release only. Promote with `git merge --no-ff develop` when you intend a release.
- Pushing `develop` to origin is authorised. Do not open a PR unless asked.

## Entra

Not implemented. Keep `DirectoryProvider` so a Graph provider can plug in later. Do not add
Microsoft Graph until asked.
