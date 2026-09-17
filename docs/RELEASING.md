# Releasing Spydr

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
`build/entitlements.mac.plist`; Spydr only needs the network *client* entitlement, since it makes
outbound LDAP connections and never listens.

## Version and branch flow

`develop` is integration; `main` is release-only. Bump `version` in `package.json`, merge
`develop` into `main` with `--no-ff`, and tag. CI packages every push to those branches and
uploads unsigned installers as artifacts.
