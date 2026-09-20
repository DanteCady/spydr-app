# SPYDR — product site

A Next.js app. The landing page is hand-written; the documentation is not — it is the desktop
app's own guide, imported from `src/help/` and rendered here, so the help inside SPYDR and the docs
on this site are the same words and cannot drift apart.

```sh
npm install
npm run dev     # http://localhost:4200
npm run build
npm start
```

## How the docs work

`src/help/articles.tsx` exports every article: id, section, title, blurb, and a React body.
`lib/docs.ts` reads that for navigation and metadata, `app/docs/[slug]/page.tsx` generates one
static page per article, and `components/DocBody.tsx` renders the body on the client — a couple of
articles use hooks, and the About page asks the desktop app for build information, which on the web
correctly reports that there is no desktop app to ask.

Adding an article to the app adds a page here. Nothing needs to be written twice.

## Release links

`lib/releases.ts` builds the download cards. Set `GITHUB_REPO` (for example
`GITHUB_REPO=owner/spydr`) and the build asks GitHub for the latest release, using the real
filenames, byte sizes and download URLs. Without it the page falls back to the 0.1.0 artefacts and
says so under the cards, rather than pretending to link to something.

## Licence keys and the API

SPYDR is free but activated. Signing up on the landing page issues a key; the desktop app checks it
on first run and roughly monthly after that.

| Route | Does |
| --- | --- |
| `POST /api/signup` | `{ email }` → `{ key, tier }`. One live key per address; asking again retires the old one. |
| `POST /api/activate` | `{ key, machine, version, os }` → a signed licence the app caches for 30 days. |
| `POST /api/telemetry` | Anonymous usage, only from installs that switched it on. Unknown fields are rejected. |
| `POST /api/recover` | Sends an existing key to the address that owns it. Always answers the same, whether or not that address has one. |
| `GET /api/pubkey` | The public half of the signing key, for building the app against this server. |

One live key per address, enforced by a partial unique index rather than by remembering to check.
Asking again neither issues a second key nor revokes the first — revoking in that moment would
break the installation someone is trying to get working — so recovery is a separate route that
emails the existing key to the address that owns it, and never returns it in the response.

Keys are stored encrypted rather than hashed, which is what makes that recovery possible. The
machine identifier arrives already hashed by the client and is hashed again with `LICENSE_PEPPER`:
enough to count installs, not enough to identify a computer.

### Generating the signing pair

```sh
npm run keygen
```

The private half goes in `LICENSE_PRIVATE_KEY`; the public half belongs in the desktop app's
`resources/license-public.pem`, so a cached activation can be verified offline. Without
`LICENSE_PRIVATE_KEY` the server generates an ephemeral pair at boot and says so on `/api/pubkey` —
fine locally, useless in production.

### Reserved keys

Ten developer keys and twenty beta keys live in the database alongside issued ones, distinguished
by a `reserved:` note and by carrying a tier above free.

```sh
KEYS_PASSPHRASE=… npm run keys:seed    # creates any that do not exist yet
KEYS_PASSPHRASE=… npm run keys:read    # prints them
```

The keys are written to `keys/reserved-keys.enc`, encrypted with AES-256-GCM over a scrypt-derived
key. The passphrase is never stored — not in the file, not in the database, not in this repository
— so losing it means reseeding. `keys/` is ignored by git: an encrypted blob in version control is
an offline cracking target, and a password manager is a better home for it.

Seeding is idempotent. A key that already exists is left alone rather than rotated, because
rotating one would break whoever is already using it.

### Environment

```sh
NEXT_PUBLIC_SITE_URL=https://spydir.io
LICENSE_DB=/var/lib/spydr/spydr.db     # SQLite, absolute, outside the deploy tree
LICENSE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…"
LICENSE_PEPPER=<32+ random bytes>      # hashes machine ids
LICENSE_SECRET=<32+ random bytes>      # encrypts stored keys; must differ from the pepper
TRUST_PROXY_HOPS=1                     # proxies in front of Node; without it rate limits collapse
SUBSCRIBE_WEBHOOK=…                    # optional, mailing list

# Mail. Required — signup refuses to run without it, because the flow sends a code.
SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587                          # 465 = implicit TLS; anything else requires STARTTLS
SMTP_USER=…
SMTP_PASS=…
MAIL_FROM="SPYDR <keys@spydir.io>"
# Instead of SMTP, either of these also works:
# MAIL_WEBHOOK=…  posts { to, subject, text, html } anywhere
# RESEND_API_KEY=…
```

In production the server **refuses to start** without the first six. Every one of them used to
have a fallback that let it run while doing something quietly wrong — signing with a throwaway
key, peppering with a string published in this repository, or trusting an X-Forwarded-For header
the caller wrote. Those failures are invisible from outside, which is why they are now fatal.

### Signing up

Two steps, because issuing a key to an unverified address meant anyone could type a stranger's
address and take the only key it would ever be given:

1. `POST /api/signup { email }` — sends a six-digit code, and answers identically whether or not
   the address is already registered.
2. `POST /api/verify { email, code }` — issues the key, or re-sends the existing one, by email.
   The key is never in the response body.

Codes are hashed with the pepper, last ten minutes, allow five wrong guesses and are destroyed on
use. A lost key is re-sent from `/key`.

### On Lightsail

Node 22 or newer, because the store uses `node:sqlite` — no native modules, nothing to compile.
Run `npm ci && npm run build && npm start` behind nginx with TLS, keep `LICENSE_DB` on a path that
survives deploys, and back that file up: it is the list of everyone using SPYDR.

## The update list

The hero carries an email field. Where the address goes is up to you — set one of these and the
form starts working:

```sh
SUBSCRIBE_WEBHOOK=https://…      # any endpoint accepting POST { email, source }
BUTTONDOWN_API_KEY=…             # posts straight to Buttondown
```

With neither set the form tells the visitor that the list is not wired up yet and that nothing was
sent or stored, rather than thanking them for an address it quietly dropped. Validation and a
honeypot field run server-side in `app/actions/subscribe.ts`; there is no client-side tracking on
the page at all.

## Screenshots

`public/assets/*.png` are captures of the app in its dark theme, cropped to the workspace column
(`x: 214–1136`) and saved at 2× so they stay sharp at the width the page renders them. `next/image`
serves AVIF and WebP from them. Retake at 1440×900 if the interface moves.

## The domain

Production is **spydir.io**. It is set in one place — `NEXT_PUBLIC_SITE_URL`, defaulting to the
production URL — and read by the metadata, the sitemap and robots.txt. Preview deployments should
set it to their own URL so they do not advertise production in canonical tags.

Worth knowing: the name has neighbours. `spydr.com` is a digital agency, `spydr.io` is a security
blog and `spydrsolutions.com` is a live business. None of them is this product, which is part of
why the site leans on being specific about what SPYDR is.

## Deploying

Vercel needs no configuration. Anywhere else, `npm run build && npm start` behind a proxy works; if
you want a purely static drop, add `output: 'export'` to `next.config.ts` and set
`images.unoptimized`.
