# Spydr

Read-only Active Directory explorer for messy on-prem directories. Electron + React. Product name is **Spydr**; repo folder is `spyder`.

## Run

```bash
npm install
npm run dev
```

`npm run typecheck` and `npm run verify:fixture` before calling UI work done.

## Architecture

- **LDAP, DC discovery, snapshots, findings, paths** live in `electron/`. Never bind or search from the renderer.
- **UI** lives in `src/`. Four workspaces after connect: Directory, Web, Pathfinder, Hygiene. Shared selection + inspector.
- **Sample forest** lives in `fixtures/contoso-lab.ts`. **Open sample directory** always works; Connect can also bind a live DC.
- **Types** live in `shared/`.
- v1 is **read-only**. No LDAP add/modify/delete. Suggested fixes are text only.
- Passwords: memory for the session; optional remember via Electron `safeStorage`. Never write them into snapshots, logs, or error strings.

## Connect

Admins bind with UPN or `DOMAIN\user`. Prefill from Windows env when present; otherwise domain FQDN → DNS SRV, or a pasted DC host/IP. LDAPS preferred; LDAP and StartTLS exist for shops without certs. Demo path is **Open sample directory**.

## Delegate

Use project subagents instead of improvising parallel patterns:

| Work | Subagent |
| --- | --- |
| Feature ideas, roadmap, scope, creep checks | `product-scope` (read-only; does not implement) |
| Connect, ldapts, ingest, fixture, DC discovery | `ad-ldap` |
| Directory / Web / Pathfinder / Hygiene / inspector | `spydr-ui` |
| graphology, cycles, paths, finding detectors | `graph-findings` |
| Password handling, TLS toggle, snapshot leakage, write attempts | `ad-security` |

Skills: `connect-onprem-ad`, `ad-hygiene-findings`.

## Git flow

- `develop` is integration and stays ahead of `main`. Branch `feature/<short-slug>` from `develop` — one product-scope item per branch.
- Commit on the feature branch. Merge with `git merge --no-ff` into `develop`.
- `main` is stable/release only. Promote with `git merge --no-ff develop` onto `main` when you intend a release.
- Do not push or open a PR unless asked.

## Entra

Not implemented. Keep `DirectoryProvider` so a Graph provider can plug in later. Do not add Microsoft Graph until asked.
