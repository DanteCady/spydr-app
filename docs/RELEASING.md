# Releasing SPYDIR

## Building installers locally

```bash
npm run package        # current platform
npm run package:mac    # dmg + zip, arm64 and x64
npm run package:win    # NSIS installer, x64 and arm64
npm run package:linux  # AppImage + deb
```

Output lands in `release/`. Cross-building Windows from macOS needs Wine; CI builds each platform
on its own runner instead.

Only `out/` and the dependencies electron-vite externalizes for the main and preload processes
(`ldapts`, `graphology`) ship. Renderer libraries are bundled by Vite and are excluded in
`electron-builder.yml`; leaving them in roughly doubles the installer.

## Code signing

**This is the remaining gap before public distribution.** An unsigned build that asks for domain
credentials will be blocked by Gatekeeper and SmartScreen, and is a reasonable thing for an admin
to refuse to run.

Locally, electron-builder picks up whatever signing identity is in the keychain — on this machine
that is an *Apple Development* certificate, which is fine for running the build yourself and not
valid for distribution.

To ship, set these as CI secrets:

| Platform | Secret | What it is |
| --- | --- | --- |
| macOS | `CSC_LINK` | base64 of a **Developer ID Application** `.p12` |
| macOS | `CSC_KEY_PASSWORD` | password for that `.p12` |
| macOS | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | notarization |
| Windows | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | code-signing certificate (EV recommended) |

Then set `notarize: true` under `mac:` in `electron-builder.yml`. macOS entitlements live in
`build/entitlements.mac.plist`; SPYDIR only needs the network *client* entitlement, since it makes
outbound LDAP connections and never listens.

## Version and branch flow

`develop` is integration; `main` is release-only. Merge `develop` into `main` with `--no-ff`, and
tag. CI packages every push to those branches and uploads unsigned installers as artifacts.

### Bumping the version

`package.json` is the only place the version is written. The About screen, the licence check, the
telemetry payload and the site's download cards all read it from there.

```bash
npm run version:bump patch    # 0.2.0 -> 0.2.1
npm run version:bump minor    # 0.2.0 -> 0.3.0
npm run version:bump major    # 0.2.0 -> 1.0.0
npm run version:bump 0.4.2    # an exact version
```

That updates `package.json` and creates `content/releases/<version>.md` for you to write. It is
one command because doing it by hand means doing half of it.

### Release notes

One Markdown file per version in `content/releases/`. Both readers pick it up automatically —
Vite globs the directory into the app's guide, Next reads it off disk for `/releases` — so there
is no index to register a new file in.

```md
---
version: "0.3.0"
date: "2026-10-01"
title: "Short, customer-facing"
summary: "One or two sentences for the card."
---

### Timeline
- **New:** Something you can now do.
- **Improved:** Something that got better.
- **Fixed:** Something that was broken.
```

Categories are the workspaces plus a general bucket: `Directory`, `Hygiene`, `Pathfinder`, `Web`,
`Timeline`, `Reports`, `Settings`, `Platform`. Bullets are `New`, `Improved` or `Fixed` only. An
unknown category or a malformed date fails the build rather than publishing something odd.

Write them for the person using SPYDIR, not from the commit log. "Re-crawl reads the directory
again with the credentials already in memory" is a release note; "refactor ingest pipeline" is not.

`npm test` fails if `package.json` and the newest notes disagree, if a file is missing its notes,
or if any release has an empty title, summary or change list. That guard is the reason the version
can be trusted anywhere it appears.

### Checklist

1. `npm run version:bump <patch|minor|major>`
2. Write `content/releases/<version>.md`
3. `npm test` — confirms the notes and the version agree
4. Merge `develop` into `main` with `--no-ff`, tag, and let CI package it
