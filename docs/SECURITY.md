# Security

SPYDIR is a desktop application that binds to a domain controller over LDAP, reads the directory
into an in-memory snapshot, scores it for hygiene problems, and can print a PDF. It is read-only:
it issues searches and nothing else.

That is a large amount of trust to ask for. Whoever runs it types directory credentials into it,
points it at a production DC, and lets it pull every user, group, OU and computer in the domain
into one process. This document describes what protects that trust, where each control lives in
the source, and where a control stops short. Anything not stated here as a control should be
assumed not to exist.

The application asks for an ordinary domain user, not a privileged one — reading the directory
needs no special rights, and the Connect screen says so at `src/workspaces/Connect.tsx:272`. If
SPYDIR is being run with Domain Admin, everything below still applies, but the blast radius of a
mistake is larger than the product intends.

---

## Threat model

Four adversaries are in scope.

**A compromised domain.** Every attribute value SPYDIR reads — `name`, `description`,
`distinguishedName`, `operatingSystem` — is written by whoever controls the objects in that
directory. In a domain that has already been breached, all of it is attacker-supplied input that
SPYDIR renders, indexes, diffs and prints. The relevant question is not whether the data is
trustworthy (it is not) but what a rendering slip would be worth.

**A local user on the administrator's machine.** Another account on the same host, or a process
running as the same user, that wants the snapshot, the timeline, the bind credentials or the
licence.

**A network attacker between the application and the DC.** Someone able to observe or modify
traffic on the path to port 389 or 636.

**An anonymous attacker against the public licence server.** Every route under `site/app/api/` is
unauthenticated by design: signing up for a free key cannot require an account. The checks in
`site/lib/server/guard.ts` are the only thing between those routes and the internet.

### Out of scope

- **A machine that is already compromised at the level of the user running SPYDIR.** A process
  running as that user can read the session file, read the memory of the main process while a bind
  is live, and replace the binary. No control here defends against that.
- **The domain controller itself.** SPYDIR trusts what the DC answers. A malicious DC can return
  whatever directory it likes; the output is only as true as the server.
- **Availability of the licence server.** The desktop application keeps working when the server is
  unreachable (`electron/license.ts:184`), so an outage is a business problem rather than a
  security one.
- **Physical access, backups, and whatever else the endpoint's own controls cover.** File modes
  are set on everything SPYDIR writes, but a backup agent reading as root is not something an
  application can prevent.
- **Supply chain of npm dependencies.** Dependencies are pinned by `package-lock.json` and
  installed with `npm ci` in CI, which is not the same as being audited.

---

## The read-only guarantee

The reason it is defensible to point this at a production DC is that SPYDIR contains no LDAP write
operation. That claim is enforced by the build rather than by reviewers remembering.

`scripts/assert-read-only.mjs` walks `electron/`, `shared/` and `src/` and checks two things. It
finds every ldapts client by where it is constructed — the regex at line 57 matches
`new Client(` and captures the variable name, so renaming the variable does not escape the check —
and then flags any method call on that variable outside the allow-list at line 29:
`bind`, `search`, `searchPaginated`, `startTLS`, `unbind`, `isConnected`. A `modify`, `add`, `del`
or `modifyDN` fails the run. Separately, at line 50, any file mentioning `child_process`,
`execFile`, `spawnSync` or `execSync` fails: an application that can shell out can perform every
write this script exists to prevent, so the route is closed rather than policed.

Failures exit non-zero with the offending file and line (line 84).

It runs in three places, so a bypass has to be deliberate:

- `npm test` runs it before the test suite (`package.json`, the `test` script).
- CI runs `npm run verify:readonly` before `npm test` (`.github/workflows/ci.yml`).
- The release workflow runs the same checks before building anything
  (`.github/workflows/release.yml`) — a tag cannot ship what a branch could not.

What the provider actually calls matches the allow-list: `client.startTLS` at
`electron/directory/ldapProvider.ts:114`, `client.bind` at line 116, `client.unbind` at line 124,
and `client.search` at lines 148 and 186. There are no other client calls in the file.

The limit of this control is its shape. It is a static check over source text in three directories.
It does not follow a client passed into a function in a fourth, and it would not catch an LDAP
write issued through some other library. It guarantees that the ldapts clients this codebase
constructs are used for reads, and that nothing in these directories shells out.

---

## Credentials

The bind password is typed in the renderer and is held, in cleartext, in exactly one place after
that: a module-level variable in the main process.

The path is:

1. `src/workspaces/Connect.tsx:52` builds a `ConnectionInput` including `password` and passes it
   over the bridge.
2. `electron/main.ts:225` receives it in the `spydir:ingest` handler, validates its shape, and
   performs the read.
3. `electron/main.ts:230` derives the reconnect profile with `toProfile(input)` and
   `electron/main.ts:231` stores the full input — password included — in `liveBind`
   (declared at `electron/main.ts:53`).
4. `electron/directory/ldapProvider.ts:116` uses it for the bind. It is not logged.

`liveBind` never travels back. The re-read handler `spydir:refresh` at `electron/main.ts:238`
takes no arguments at all: the renderer asks for a re-read and the main process supplies the
credentials from its own memory, so the renderer never has to hold a password in order to ask.
`spydir:can-refresh` (line 244) returns only a boolean. The preload bridge exposes
`refresh()` with no parameters (`electron/preload.ts:17`).

It is dropped on disconnect and on quit. `spydir:forget-bind` at `electron/main.ts:247` clears
`liveBind`, `lastProfile` and `lastRead`; the renderer calls it from `disconnect()` at
`src/state.tsx:246`. The `will-quit` handler at `electron/main.ts:384` clears it again.

**What reaches disk.** `toProfile()` at `electron/directory/session.ts:48` constructs the saved
profile field by field — `domain`, `host`, `port`, `protocol`, `bindUsername`, `baseDn`,
`trustServerCert` — and `password` is not among them. It is built by enumeration rather than by
deleting a key from a copy, so a new secret added to `ConnectionInput` would have to be added here
explicitly before it could reach the session file. Deriving the profile in main (line 230 of
`main.ts`) rather than accepting one over IPC means the renderer is never trusted to do the
stripping.

**What reaches error messages.** `mapLdapError` in `electron/directory/errors.ts` maps the common
LDAP failures to fixed strings that contain no input. Anything it does not recognise falls through
to line 28, which returns the server's message with `password=` or `password:` followed by
non-whitespace rewritten to `password=***`. That is a targeted scrub of the one pattern ldapts and
Node are known to produce, not a general-purpose redactor: a server that echoed a credential in
some other shape would pass through it.

Password persistence is not offered. `ConnectionInput.rememberPassword` exists in the type
(`shared/types.ts:107`) and is hard-coded to `false` at `Connect.tsx:62`; nothing reads it.

---

## The desktop application's boundaries

**Process isolation.** The window is created at `electron/main.ts:131` with `contextIsolation: true`,
`nodeIntegration: false` and `sandbox: true`. The renderer has no `require`, no Node globals, and
no direct access to main's context.

**The bridge.** `electron/preload.ts` exposes a single frozen-by-`contextBridge` object of named
functions (`contextBridge.exposeInMainWorld('spydir', api)` at line 77). Each is a thin wrapper
around one `ipcRenderer.invoke`/`send`/`sendSync` channel. There is no generic "invoke this
channel" escape hatch, no `ipcRenderer` handed across, and no filesystem or network primitive.
Everything the renderer can cause to happen is enumerable by reading that file.

**Content Security Policy.** `applyCsp()` at `electron/main.ts:347` installs a header on every
response in the default session. The production policy (line 352) is:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:;
font-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none';
form-action 'none'
```

`connect-src 'none'` is the one that matters. The renderer makes no network requests of its own —
every outbound call (LDAP, licence, telemetry, updates) happens in main — so denying the renderer
any network destination at all means injected script has the directory in front of it and nowhere
to send it. `object-src`, `frame-src`, `base-uri` and `form-action` close the other exfiltration
and redirection routes.

The development policy (line 351) is looser by necessity: `'unsafe-inline'`, `'unsafe-eval'` and a
websocket connection to localhost, because Vite's hot reload needs them. It applies only when
`ELECTRON_RENDERER_URL` is set, which a packaged build never does. A developer running
`npm run dev` against a live directory is running with a materially weaker policy.

React escapes the directory data it renders and there is no `innerHTML` in `src/`. The CSP is what
decides what a future slip would be worth, not what makes the current code safe.

**Navigation and external links.** `isSafeExternal()` at `electron/main.ts:97` parses a URL and
returns true only for `https:` and `http:`. It guards both places a URL can leave the application:
the window-open handler at line 146 and `will-navigate` at line 154. The reason is specific and
written at line 88 — `shell.openExternal` hands a URL to whatever the OS has registered for the
scheme, and on Windows a `file://` or `smb://` link to an attacker's host makes the machine
authenticate outbound and leak that account's NetNTLM hash with no prompt. `ms-msdt:` and
`search-ms:` are the same family. Directory `description` fields are attacker-controlled in a
compromised domain, which is exactly where such a URL would come from.

`will-navigate` (line 151) also prevents the window from ever rendering a document other than
SPYDIR's own, checked by `isOwnDocument()` at line 106 — anything else would inherit the preload
bridge and with it the ability to bind to a directory. `will-attach-webview` (line 156) is
unconditionally prevented. `will-download` (line 370) cancels every download: SPYDIR saves exactly
one thing, the report, and it does that through a save dialog, so a download arriving here was
started by the page rather than by the person. `setPermissionRequestHandler` (line 360) denies
every permission request — camera, microphone, geolocation, notifications — rather than relying on
Chromium's defaults for the `file://` origin a packaged build runs from.

**IPC input validation.** The renderer chooses where to bind, because that is where the person
types it, but it cannot choose anything whose shape is not checked first.

- `isHostish()` at `electron/main.ts:173` requires a non-empty string of at most 253 characters
  matching `/^[A-Za-z0-9._-]+$/`. It guards `spydir:discover` (line 206) because `discoverDcs()`
  concatenates the value into an SRV lookup (`electron/directory/discoverDc.ts:15`) — without a
  bound, the renderer would have a general-purpose DNS channel where the query name is the message.
- `validConnection()` at `electron/main.ts:181` guards `spydir:test` and `spydir:ingest`. It
  requires an object, a host-shaped `host`, an integer `port` in 1–65535, a `protocol` of exactly
  `ldap`, `ldaps` or `starttls`, and length-bounded `domain`, `bindUsername` and `baseDn`.
  **One caveat, and it is a real defect rather than a design limit:** line 195 tests
  `typeof c.bindPassword === 'string'`, but the field on `ConnectionInput` is `password`
  (`shared/types.ts:104`), which is what the renderer sends and what the provider binds with. As
  written, the predicate is false for every connection the UI produces and both handlers throw.
  It should be `c.password`. Nothing insecure follows from it — it fails closed — but no reader
  should take the field list above as a description of a path that currently works.
  `trustServerCert` is not validated at all; an absent or non-boolean value is falsy, which lands
  on certificate verification being enabled, so the failure direction is the safe one.
- `spydir:role` at `electron/main.ts:321` dispatches through a literal record of six clipboard and
  undo actions. Looking the role up as a method name on `webContents` would let the renderer call
  anything on it, including methods that open devtools or navigate the window.
- `spydir:session:save` at `electron/main.ts:257` refuses any snapshot whose `source` is not
  `'ldap'`. There is one session slot, and the sample directory taking it would overwrite a real
  read along with the profile needed to reconnect.

**The report window.** The PDF is rendered in a separate offscreen `BrowserWindow`
(`electron/report/index.ts:71`) with `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true` and no preload, loading nothing but the HTML file written a moment earlier. The
report data is embedded as JSON with `<` escaped (`electron/report/html.ts:34`) and every
directory-derived string is escaped again before it reaches `innerHTML`
(`electron/report/html.ts:200`). That window has script enabled, because pagination is measured in
the page; it has no bridge and nothing to reach.

---

## Data at rest

Everything SPYDIR writes goes under `app.getPath('userData')`, in a directory created with mode
`0o700`.

| What | Where | Mode | Encrypted |
| --- | --- | --- | --- |
| Session snapshot | `session/last-session.bin` | `0o600` (`session.ts:87`) | safeStorage, when available |
| Session header | `session/last-session.json` | `0o600`, re-applied on every write (`session.ts:89–93`) | No |
| Settings | `settings.json` | `0o600` (`electron/settings.ts:33`) | No |
| Licence | `licence.json` | `0o600` (`electron/license.ts:90`) | No |
| Change timeline | `timeline.db` (+ `-wal`, `-shm`) | `0o600` (`electron/timeline.ts:75`) | Detail column only |
| Report PDF | Wherever the save dialog is pointed | OS default | No |

**The snapshot** is gzipped and then, if `safeStorage.isEncryptionAvailable()`, encrypted with the
OS keychain (`electron/directory/session.ts:72`). It is written to a temp file and renamed, so a
crash cannot leave a half-written session. It is only written at all with explicit consent:
`shared/session.ts:16` refuses the fixture outright and requires `consent === 'yes'` for anything
else, and the default is `'unset'` (`shared/settings.ts:158`).

**The session header** is deliberately not encrypted, because the Connect screen needs to describe
the saved session without decrypting it. It contains the domain, the DC hostname, the base DN and
the bind username in plain JSON. The mode is re-applied with an explicit `chmodSync` on every
write (line 93) rather than relying on `writeFileSync`'s `mode`, which only applies when the file
is created — an earlier build left it at the umask default.

**The timeline** splits storage on purpose (`electron/timeline.ts:9–20`). Structure — timestamp,
DC host, base DN, scope flags and counts — is stored in the clear so entries can be listed and
indexed. The human detail, the diff with its names and distinguished names, is encrypted with
safeStorage in the `detail` blob (`electron/timeline.ts:83`). Object GUIDs are indexed in the
clear, on the grounds that a GUID alone names nobody. Timeline entries are written only under the
same consent that governs the snapshot (`electron/main.ts:69`) and are pruned to
`historyRetentionDays`, default 90 (`shared/settings.ts:160`).

**On Linux without a keyring**, `safeStorage.isEncryptionAvailable()` returns false. Both the
session and the timeline detail then fall back to plaintext on disk — gzipped in the session's case,
which is not encryption — protected by file mode alone (`session.ts:73`, `timeline.ts:88`). The
`encrypted` flag in the session header and the `detail_encrypted` column record which happened, and
the UI surfaces it, but there is no prompt and no refusal to write.

A session written under a different OS user or keychain cannot be read back. Rather than leaving a
restore option that always fails, `loadSession()` deletes it (`session.ts:117`).

`forgetOnQuit` (default off, `shared/settings.ts:159`) clears the session on exit
(`electron/main.ts:387`).

---

## Licence integrity

A licence is only what the server signed. `verify()` at `electron/license.ts:59` loads the public
key, Ed25519-verifies the signature over the payload bytes, and returns the parsed licence only if
both succeed. Any throw returns `null`.

It fails closed in the way that matters: with no public key available, line 61 returns `null`
before doing anything else. The stored file is plain base64 JSON in the user's own home directory,
so failing open would make that file authoritative about tier and features — exactly backwards.
`toState()` (line 96) distinguishes the two failures for the person reading the message: a build
that cannot verify at all is a reinstall, a signature that does not match is a key to re-enter.

`publicKeyPem()` at `electron/license.ts:40` looks in four locations, the first being
`process.resourcesPath`. Packaged builds put it there through `extraResources` in
`electron-builder.yml`, which carries `resources/license-public.pem` to `license-public.pem` in
the bundle, with a comment saying it is not optional. The others are development paths.

The signed payload (`site/app/api/activate/route.ts:75`) contains the canonical key, email, tier,
features, expiry and a `notAfter` 30 days out. It does not contain the machine identifier, so a
licence file copied to another machine will verify there. For a free key this is an accepted
trade rather than an oversight, but it is not a licence-enforcement boundary.

The endpoint the application talks to is fixed in packaged builds. `siteBase()` at
`electron/endpoints.ts:17` returns `https://spydir.io` whenever `app.isPackaged` is true, and only
consults `SPYDIR_LICENSE_API` in development. Anything able to set a variable in the user's
environment could otherwise point activation and telemetry at a host of its choosing.

The machine identifier sent with an activation is a SHA-256 of hostname, platform, architecture and
userData path (`electron/license.ts:76`), hashed on the client before it leaves, and peppered again
server-side (`site/app/api/activate/route.ts:63`). It exists to count installs.

---

## Telemetry

Off by default and never inferred from anything else: `telemetry: false` at
`shared/settings.ts:161`. `sendNow()` returns early if it is off (`electron/telemetry.ts:74`), and
`maybeSend()` checks again and rate-limits itself to once every three days
(`electron/telemetry.ts:18, 90`).

The payload is built by pure shared code so that the "show me exactly what you send" button in
Settings renders the real thing rather than a description of it. `ALLOWED_KEYS` at
`shared/telemetry.ts:76` lists the ten fields that may be sent; `sanitize()` at line 90 constructs
the outgoing object by copying only those keys, so a field added to the payload type does not
travel until it is added to the list. `currentPayload()` (`electron/telemetry.ts:52`) is the only
producer and it always sanitizes.

Counts are bucketed rather than exact (`shared/telemetry.ts:29`): `1k-10k` rather than 4,312,
because an exact object count is close to an organisation's fingerprint. `domainCount` is how many
directories are open, not which. `install` is a random UUID stored in settings
(`electron/telemetry.ts:31`), regenerated by clearing them. There is no domain, no account name, no
group, no DN, and nothing derived from directory contents other than sizes.

The server enforces the same list independently. `site/app/api/telemetry/route.ts:16` holds its own
copy of the allowed keys and line 78 rejects any payload containing anything else with a 400 — so a
future client bug cannot quietly start sending more than was promised. `tidy()` at line 37 then
rebuilds every accepted field to a known type and length, because the key allow-list alone still
permitted an allowed key holding fifty megabytes; a full disk on that box stops activation working
for everyone. Nothing is queued to disk on the client: a failed send is lost
(`electron/telemetry.ts:85`).

---

## The licence server

Everything under `site/app/api/` is anonymous. There are no sessions, no accounts and no CSRF
tokens, because there is nothing to authenticate against.

**Client address.** `clientIp()` at `site/lib/server/guard.ts:20` counts in from the *right* of
`X-Forwarded-For`, by the number of proxies declared in `TRUST_PROXY_HOPS`. The left end of that
header is whatever the client wrote; only the right end is appended by infrastructure that is
actually in the path. Reading `[0]` — the obvious implementation, and what this used to do — hands
the rate limiter a value the attacker picks, which makes every limit on the box decorative. If
`TRUST_PROXY_HOPS` is unset, or the header has fewer entries than there are declared hops, the
function returns the literal `'untrusted-proxy'`: everybody shares one bucket and throttling is
harsh and wrong, which is the correct failure for a server that has not been told how it is
deployed.

**Body size.** `readJson()` at `site/lib/server/guard.ts:52` checks `Content-Length` first because
it is free, then counts the stream as it arrives because `Content-Length` is a claim rather than a
fact, and aborts past 8 KiB (line 43). `await request.json()` would have buffered the whole body
before any route code ran.

**Address folding.** `foldEmail()` at `site/lib/server/guard.ts:87` normalises to NFKC, lowercases,
and strips plus-addressing from the local part. "One key per address" is only as true as the
definition of "same address"; without this a single mailbox could hold as many keys as it asked
for. `readEmail()` (line 98) bounds the length at 254 and applies a shape check.

**Fail-closed configuration.** `requireProductionEnv()` at `site/lib/server/env.ts:61` is called at
the top of every route and, in production, throws unless `LICENSE_PRIVATE_KEY`, `LICENSE_PEPPER`,
`LICENSE_SECRET`, `LICENSE_DB` and `TRUST_PROXY_HOPS` are present and plausible — a PKCS#8 PEM, at
least 32 characters of randomness for each secret, an absolute DB path, a small integer for the
hops. Line 75 additionally refuses to start if the secret and the pepper are the same value. Each
previously had a fallback that let the server keep answering 200s while doing something quietly
wrong: signing with a key generated at boot that no installed copy can verify, or peppering with a
string published in the source. None of those failures are visible from outside, which is what
makes them worth refusing over. Development keeps the fallbacks so a checkout runs with no setup.

**Rate limiting and caps.** `rateLimit()` at `site/lib/server/store.ts:109` is a fixed window in
memory, swept every 60 seconds and capped at 50,000 buckets; past the cap, new buckets are refused
rather than admitted, so the failure direction is "too strict" instead of "out of memory". Limits
per hour per address: signup 10, recover 10, verify 20, activate 60, telemetry 120.
`underGlobalCap()` (line 133) counts real rows in a real window, which survives a restart in a way
the in-memory limiter cannot: 5,000 licences per day (signup answers 503 past it) and 200,000
telemetry rows per day (silently 204, because a counter is not worth an error budget). Being
in-process, the limiter resets on deploy and does not coordinate across instances.

**Database.** `site/lib/server/store.ts:16` creates the directory `0o700` and chmods the database
and its WAL and SHM companions to `0o600` on every open — that file holds every registered address
and a decryptable key for each. One live key per address is enforced by a partial unique index
(line 50) rather than by remembering to check. Every statement in the file is a literal with bound
parameters; no SQL is built from a string.

**Key storage.** Keys are stored twice: hashed for lookup (`keys.ts:35`) and encrypted for
recovery. `encryptKey()` at `site/lib/server/secret.ts:43` uses AES-256-GCM with a random 16-byte
salt and 12-byte IV per record, the key derived by scrypt with N=2^15, r=8, p=1 (line 37). The
per-record salt means rows stay independent and there is no precomputation across the table. The
original derivation was a single SHA-256 pass, which is not a key derivation function at all; it
survives only in `decryptKey()` (line 58) to read rows written before the change, and
`isLegacyFormat()` (line 69) marks them for rewriting. Encrypted rather than hashed is a deliberate
trade, explained at the top of the file: with one key per address, a hashed key makes "I lost my
key" permanently unanswerable.

**Key generation and signing.** `newKey()` at `site/lib/server/keys.ts:13` takes 20 random bytes
and maps each through a 32-character Crockford base32 alphabet — 256 is a multiple of 32, so the
modulo introduces no bias — giving 100 bits. `signPayload()` (line 69) signs the activation
response with Ed25519. `signingKey()` (line 51) will generate an ephemeral pair if
`LICENSE_PRIVATE_KEY` is unset, and reports `ephemeral: true` through `/api/pubkey` when it has;
production cannot reach that path because `requireProductionEnv` refuses to start without the key.

**Email verification.** `site/lib/server/otp.ts` exists to close a specific hole rather than to
fight spam: issuing a key on an unverified address meant anyone could type a stranger's address,
take the only key that address will ever be given, and leave the real owner permanently unable to
sign up for something they never received. Codes are six digits, ten minute TTL, hashed with the
pepper and the address mixed in so a stolen hash cannot be replayed elsewhere (line 34), never
stored in the clear. What makes a six-digit code safe is the attempt cap, not the code: five wrong
guesses destroys the challenge (line 115), a correct one consumes it (line 110), comparison is
`timingSafeEqual` (line 47), asking again replaces the code rather than adding a second live one,
and the send counter survives the replacement so repeated asking is bounded at five (line 72).

**The routes.**

- `/api/signup` (`site/app/api/signup/route.ts`) issues no key. It sends a code and answers
  identically whether or not the address is already registered. It used to reply 409 "that address
  already has a key", which told anyone who asked which addresses were registered, and the 200 case
  issued the key to whoever typed the address. Both are closed by proving readability first.
- `/api/verify` issues the key, or re-sends the existing one, only after the code checks out. The
  key goes by email in both cases and is never in the response body — only a
  `SPYDIR…XXXXX` hint — so it cannot be taken by anyone who merely watched the code go past.
- `/api/recover` always answers 202 with the same string. The subtle part is at
  `site/app/api/recover/route.ts:41`: a decrypt or a mail send can only fail for an address that
  *is* registered, so letting either throw would have produced 500 for known addresses and 202 for
  unknown ones — the enumeration oracle the design existed to avoid, reached from the other
  direction. The work is therefore wrapped and deliberately not awaited, so the response is not
  timed differently either. Failures go to the server log, which is the only place that can safely
  say more.
- `/api/activate` returns 404 for an unknown key and 403 for one withdrawn or expired, which is what
  lets the client tell "the server has answered about this key" apart from "the server is
  unreachable" (`electron/license.ts:139`). Key enumeration against it is bounded by the 100-bit
  keyspace and 60 requests per hour.
- `/api/pubkey` publishes the public half of the signing key. Publishing it is the point.

**Headers.** `site/next.config.ts:12` sets CSP (`default-src 'self'`, `connect-src 'self'`,
`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`), HSTS for a
year including subdomains, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` denying camera,
microphone and geolocation. They are set in the application rather than only at nginx so they
survive a proxy being rebuilt by someone who never saw the file. `script-src` includes
`'unsafe-inline'`, which Next's hydration requires; the site is static marketing and docs.

---

## Transport

`clientOptions()` at `electron/directory/ldapProvider.ts:97` sets `tlsOptions` **only** when the
protocol is `ldaps` (line 102). This is not cosmetic: ldapts treats the presence of `tlsOptions` as
"this socket is TLS" and would negotiate against a plaintext port, breaking both LDAP and StartTLS.
StartTLS passes its own options when it upgrades the socket, which is a separate call at line 114.
`tests/connection.test.ts` pins all three cases.

`trustServerCert` maps to `rejectUnauthorized: !input.trustServerCert` in both places. Setting it
disables certificate verification for that connection — hostname and chain both — which means an
attacker who can intercept the path to the DC can present any certificate and see the bind
credentials and the entire directory. It exists because an internal CA that was never distributed
is the normal state of a lot of domains, and the in-app guidance says to install the CA certificate
instead where the directory is production (`src/help/basics.tsx`). The default is off
(`shared/settings.ts:149`) and the default protocol is LDAPS (`shared/settings.ts:143`).

It is persisted. `toProfile()` (`session.ts:56`) carries `trustServerCert` into the saved session
profile, and `Connect.tsx:41` restores it into the form on the next run. A decision taken once
against a lab DC comes back pre-ticked, which is the sharp edge of this control and is discussed
again under gaps below.

---

## Known gaps

Stated plainly, because a security document that lists only its strengths is not useful to anyone
deciding whether to run this.

**Builds are not code signed.** `electron-builder.yml` sets `notarize: false`, CI packages with
`CSC_IDENTITY_AUTO_DISCOVERY: false`, and `.github/workflows/release.yml` only signs if
`CSC_LINK` / `WIN_CSC_LINK` secrets exist, which they do not yet. The practical consequences: there
is nothing cryptographic tying a downloaded installer to this project, macOS Gatekeeper and Windows
SmartScreen will both complain, and auto-update on macOS cannot work at all — Squirrel verifies the
downloaded application against the running one's signing identity and refuses a mismatch. Until
this is in place, verify downloads out of band.

**`trustServerCert` persists into the saved profile** (`session.ts:56`, restored at
`Connect.tsx:41`). It is per-connection rather than global, and it is visible as a ticked checkbox,
but it is not re-asked. Someone who ticked it once for a lab controller and later connects to
production with the same saved profile will connect with verification disabled unless they notice
and untick it.

**Plaintext LDAP is selectable.** `protocol: 'ldap'` is accepted by `validConnection`
(`electron/main.ts:190`) and offered in the dropdown (`Connect.tsx:226`). On port 389 with no
StartTLS, the bind password and the entire directory cross the network in the clear. It is not the
default, and the guide says what it costs, but nothing prevents it.

**Encryption at rest depends on the OS keychain.** On Linux without a keyring, the session snapshot
and timeline detail are written unencrypted and protected by file mode alone. See *Data at rest*.

**Settings and licence files are not encrypted.** `settings.json` is `0o600` but plain, and it holds
`updates.feedUrl`. That value is constrained to `https://` (`shared/settings.ts:297`), but a local
process running as the user could point the update feed at a host it controls — which, combined
with unsigned builds, is the most direct local-attacker path in the application. The same class of
attacker can read the session file directly, so this changes the shape of the attack rather than
enabling something otherwise impossible.

**The report is written through a temporary file.** `electron/report/index.ts:68` writes the full
report HTML — findings, object names, DNs — to `app.getPath('temp')` with the default file mode,
and unlinks it after printing (line 95). On a system with a shared temp directory, that file is
briefly readable by other local users.

**`validConnection` tests the wrong field name.** `electron/main.ts:195` checks `bindPassword`
where the type and the renderer use `password`, so the guard currently rejects every connection.
It fails closed, but it is a bug and should be corrected before the field list in that predicate is
relied on.

**The in-memory rate limiter is per-process.** It resets on deploy or restart and does not
coordinate across instances. The global caps in `underGlobalCap()` are the part that survives.

**Dependencies are pinned, not audited.** `npm ci` against `package-lock.json` in CI. No SBOM, no
provenance attestation, no automated advisory gate in the pipeline today.

**No formal third-party review.** The codebase has been through an internal adversarial review and
a round of hardening, which is what this document describes. It has not been independently audited.

---

## Reporting a vulnerability

Mail **security@spydir.io**.

SPYDIR is run by people holding directory credentials against production domain controllers, so
anything touching that is answered before whatever else is in the queue — expect a reply within a
few days, and a name in the release notes if you would like one.

Please describe the class of problem rather than publishing a working exploit, and give us a chance
to fix it before you write it up. If it affects the licence server rather than the application, say
so: they are different systems with different blast radii.

**Please do not send us your directory.** A snapshot is your organisation's structure — every
account, group and membership in it. We do not want a copy and cannot look after one properly. If a
problem cannot be described without the data, say so and we will find a way to narrow it down that
does not involve sending it: a count, a shape, a single object with the names changed.

The same wording, and the support and feedback addresses, are in the in-application guide at
`src/help/contact.tsx`; the addresses themselves are defined once in `shared/contact.ts`.
