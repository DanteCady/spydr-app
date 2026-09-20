# Deploying the SPYDIR licence server

This is the whole job, in order, for one person at a keyboard. It assumes no knowledge of the
codebase and no prior deployment: `spydir.io` is not registered yet and nothing has been installed
on a server.

What you are deploying is one Next.js application that is two things at once. It is the marketing
and documentation site, and it is the licence server: it issues a free licence key after proving
someone can read the address they signed up with, signs activations with Ed25519 so the desktop app
can trust a cached answer for a month, receives opt-in telemetry, and keeps all of it in SQLite on
the instance through `node:sqlite`. There is no database server, no native module and nothing to
compile.

It supersedes the deployment notes in `site/README.md`, which are a sketch rather than a procedure.

## Decisions you have to make first

These are genuinely open. Nothing in the code settles them, and two of them are awkward to change
afterwards.

**1. Which signing key ships.** `resources/license-public.pem` is committed and is baked into every
installer by `electron-builder.yml` (`extraResources`). The desktop app verifies every activation
against it and `electron/license.ts` refuses to trust a licence it cannot verify, so the private
half held by the server must be the partner of that exact file. The private half is *not* in the
repository — `.env*` is git-ignored — and at the time of writing it exists only in the developer's
local `site/.env.local`. So you choose:

- *Generate a fresh pair* (recommended while nothing has been distributed). You overwrite
  `resources/license-public.pem`, commit it, and cut a release before anyone installs SPYDIR. Every
  installer built before that change will reject every activation, permanently.
- *Promote the existing pair.* The current private key moves from a laptop's `.env.local` to the
  server and stops being a development key. Nothing needs rebuilding, but a key that has lived in a
  development checkout is now the production signing key.

Either way, step 9 of the smoke test proves you got it right.

**2. Registrar and DNS host.** Any registrar will do. Lightsail has its own DNS zones and Route 53
is the obvious alternative; the runbook below assumes you point the domain's nameservers at
whichever you pick and create two records.

**3. Mail provider.** Signup does not work without one. Amazon SES is the cheapest fit on AWS and
has a sandbox you must escape first (see *Mail*). Resend is supported directly and is faster to get
sending. This is a real fork in the road — see that section before committing.

**4. Instance plan.** See *The instance* for the reasoning; the plan names and prices change often
enough that you should read them at purchase rather than trust a number written here.

---

## 1. Prerequisites

### The domain

Register `spydir.io`. Note that the name has neighbours — `spydir.com`, `spydirsolutions.com` and
an unrelated security blog — so check what you are buying is the one you mean.

`https://spydir.io` is hard-coded as the production site in two places that matter:

- `electron/endpoints.ts` — a packaged desktop build talks to `https://spydir.io` and, deliberately,
  ignores the `SPYDIR_LICENSE_API` override when packaged. An installed copy will talk to this
  domain and nowhere else.
- `site/app/layout.tsx`, `sitemap.ts` and `robots.ts` default to it via `NEXT_PUBLIC_SITE_URL`.

If you deploy under a different name, the desktop app cannot reach it without a code change.

### DNS

Once the instance has a static IP (next section), create:

```
spydir.io.        A     <static IP>
www.spydir.io.    A     <static IP>
```

Wait for both to resolve before running certbot. Let's Encrypt validates over HTTP against the live
record, and a cached NXDOMAIN will fail the issuance with a confusing error.

```bash
dig +short spydir.io
dig +short www.spydir.io
```

### The instance

Create a Lightsail instance with the **Ubuntu 24.04 LTS** blueprint.

Take the **2 GB RAM / 2 vCPU** plan rather than the 1 GB one. Serving is cheap — SQLite is a file
and Next is answering a handful of static pages plus small JSON routes — but `next build` is not,
and on 1 GB it will be killed by the OOM reaper partway through with an error that looks like a
compiler bug. If you are already on 1 GB, add swap before building:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Disk is not the constraint the licence table imposes; telemetry is. `POST /api/telemetry` accepts up
to 200,000 rows per day before it starts silently dropping them (the global cap in
`site/lib/server/store.ts`), so the standard 60 GB volume has years in it, but it is the table to
watch.

Then, in the Lightsail console:

- **Attach a static IP.** Without one the public address changes every time the instance is stopped
  and started, which breaks DNS and the certificate renewal along with it.
- **Networking → firewall:** allow TCP 22, 80 and 443. Nothing else. Node listens on 4200 but only
  on loopback, so 4200 must never be opened.

### Node

`site/lib/server/store.ts` reaches for SQLite with
`process.getBuiltinModule('node:sqlite')`. That module landed in Node 22.5 behind
`--experimental-sqlite` and stopped needing the flag in 22.13 and 23.4. Node 22.13 or newer will
therefore work, but **install Node 24 LTS** so the question never arises and so you are on a release
line with security support.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx sqlite3
node -v          # expect v24.x
node -e "process.getBuiltinModule('node:sqlite'); console.log('sqlite ok')"
```

The last line is the check that matters. If it throws, nothing else in this document will work.

---

## 2. Generating the secrets

Do this on your own machine, not on the server, so the shell history holding them is one you
control.

### The Ed25519 signing pair

```bash
cd /path/to/spyder/site
npm install
npm run keygen
```

That runs `site/scripts/keygen.mjs` and prints two things: a single-line
`LICENSE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…"` for the server environment, and the public
half to save as `resources/license-public.pem`.

**This is the step that is easy to get silently wrong.** The server signs activation responses with
the private half (`site/lib/server/keys.ts`); the desktop app verifies them against whatever
`resources/license-public.pem` contained when its installer was built. A mismatch does not produce
an error on the server — activation returns a perfectly well-formed signed payload, and every
installed copy of SPYDIR rejects it as forged. If you generated a new pair here, overwrite
`resources/license-public.pem`, commit it, and publish a release built from that commit before
anyone installs.

The single-line form with literal `\n` is deliberate: `keys.ts` calls
`pem.replace(/\\n/g, '\n')` before parsing, and a systemd environment file cannot hold a value that
spans lines. Keep it exactly as `keygen` printed it, quotes included.

### The pepper and the secret

```bash
openssl rand -hex 32     # LICENSE_PEPPER
openssl rand -hex 32     # LICENSE_SECRET
```

Run it twice and keep the two outputs apart. Hex rather than base64 because the value goes into a
systemd environment file, and hex has no characters that any parser along the way will argue about.
Sixty-four characters comfortably clears the 32-character minimum both are checked against.

They must not be the same value. `requireProductionEnv` refuses to run if they are, because the
pepper hashes machine identifiers and verification codes while the secret encrypts stored licence
keys — one leak should not do both jobs.

Put all three in a password manager now. What losing each one costs:

| Lost | Consequence |
| --- | --- |
| `LICENSE_PRIVATE_KEY` | Every installed copy rejects every activation. Unrecoverable without shipping a new release carrying a new public key. |
| `LICENSE_SECRET` | The `key_enc` column becomes undecryptable, so "send me my key again" stops working for every existing user and they have to be reissued by hand. |
| `LICENSE_PEPPER` | Live verification codes stop matching and machine identifiers re-hash differently, so activation counts fork. Existing licences keep working. |

---

## 3. The environment

### What the server refuses to start without

`site/lib/server/env.ts` is the authority. These five are checked on the first request each API
route handles, in production only, and the exact rules are:

| Variable | Rule applied | Missing or wrong means |
| --- | --- | --- |
| `LICENSE_PRIVATE_KEY` | must contain `BEGIN PRIVATE KEY` (a PKCS#8 PEM) | Every activation is signed by a key generated at boot, so no installed copy can verify it and a restart invalidates every licence already issued. |
| `LICENSE_PEPPER` | at least 32 characters | Machine identifiers are hashed with a value published in the source, so anyone can reproduce them. |
| `LICENSE_SECRET` | at least 32 characters | Encrypting stored licence keys falls back to the pepper, so one leak does both jobs. |
| `LICENSE_DB` | must start with `/` | The default path puts the database inside the deploy tree, where a deploy can erase it. |
| `TRUST_PROXY_HOPS` | a single digit, `1`–`9` | Rate limits collapse into one shared bucket for the whole internet. |

Plus one cross-check: `LICENSE_SECRET` and `LICENSE_PEPPER` must differ.

Two details about how this fires. It only applies when `NODE_ENV=production` — `next start` sets
that itself, but the unit below sets it explicitly, because a stray `NODE_ENV` turns every one of
these refusals off silently. And it runs on the **first request to each route**, not at boot: Next
has no boot hook that runs reliably in every deployment shape. A misconfigured server therefore
starts cleanly, serves the site happily, and returns 500 from the API. Do not read "systemd says
active" as "configured".

`TRUST_PROXY_HOPS` is `1` for the topology in this document — one nginx in front of Node. If you
later put Cloudflare or a load balancer in front of nginx, it becomes `2`. Getting it wrong is
covered in *nginx*, which is where the damage happens.

### What the product needs beyond that

These are not enforced by `env.ts`, but the thing they power does not work without them.

| Variable | Read by | Without it |
| --- | --- | --- |
| `SMTP_HOST` | `lib/server/mail.ts` | `canSendMail()` is false and `POST /api/signup` returns 503 with "Email is not available right now" rather than promising a code it never sent. Nobody can get a key. |
| `SMTP_PORT` | same | Defaults to 587. `465` means implicit TLS; anything else connects in the clear and is forced to upgrade via STARTTLS (`requireTLS`), so credentials are never sent unencrypted either way. |
| `SMTP_USER`, `SMTP_PASS` | same | Authentication is omitted entirely, which almost every relay will refuse. |
| `MAIL_FROM` | same | Defaults to `SPYDIR <keys@spydir.io>`. Set it to an address the provider has actually verified. |
| `MAIL_WEBHOOK` | same | Alternative to SMTP: receives `POST { to, subject, text, html }`. Only consulted when `SMTP_HOST` is unset. |
| `RESEND_API_KEY` | same | Second alternative, posting to the Resend API. Only consulted when neither of the two above is set. |
| `NEXT_PUBLIC_SITE_URL` | `app/layout.tsx`, `sitemap.ts`, `robots.ts` | Defaults to `https://spydir.io`. **Inlined at build time**, so it must be set for `npm run build`, not only for the service. A staging deployment that omits it advertises production in its canonical tags. |
| `GITHUB_REPO` | `lib/releases.ts` | The download cards fall back to the 0.1.0 filenames and sizes and say so, rather than linking to something that may not exist. Set it to `DanteCady/spydr-app`, matching the `publish:` block in `electron-builder.yml`. |
| `PORT` | `next start` | Optional; the unit passes `-p 4200` explicitly. |

`site/README.md` mentions `SUBSCRIBE_WEBHOOK` and `BUTTONDOWN_API_KEY`. Nothing in the code reads
either any more — the hero email field now goes through `/api/signup`. Do not set them.

`KEYS_PASSPHRASE` and `KEYS_FILE` belong to the reserved-keys script only and must **not** go in the
service environment. See *Reserved keys*.

### Writing the files

Two files, because two of these variables are not secrets and the build needs them:

```bash
sudo mkdir -p /etc/spydir
sudo tee /etc/spydir/build.env >/dev/null <<'EOF'
NEXT_PUBLIC_SITE_URL=https://spydir.io
GITHUB_REPO=DanteCady/spydr-app
EOF

sudo -e /etc/spydir/spydir.env
```

In that editor, paste — with your own values:

```
LICENSE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMC4CAQ…\n-----END PRIVATE KEY-----"
LICENSE_PEPPER=<the first openssl rand -hex 32>
LICENSE_SECRET=<the second one, different>
LICENSE_DB=/var/lib/spydir/spydir.db
TRUST_PROXY_HOPS=1

SMTP_HOST=email-smtp.eu-west-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<SES SMTP username>
SMTP_PASS=<SES SMTP password>
MAIL_FROM="SPYDIR <keys@spydir.io>"
```

Then fix the ownership, which is the point of having a separate file at all:

```bash
sudo chown root:spydir /etc/spydir/spydir.env
sudo chmod 640 /etc/spydir/spydir.env
sudo chmod 644 /etc/spydir/build.env
```

Mode 640 with group `spydir` means the service can read it and no other account on the box can.
Do not put the secrets in `site/.env.local` on the server: it would be readable by anything running
as the service, it sits inside the deploy tree, and a file in the working directory is easy to copy
somewhere it should not be.

---

## 4. Filesystem layout and the service user

```bash
sudo adduser --system --group --home /var/lib/spydir --shell /usr/sbin/nologin spydir
sudo mkdir -p /var/lib/spydir /srv/spydir
sudo chown spydir:spydir /var/lib/spydir
sudo chmod 700 /var/lib/spydir
sudo chown spydir:spydir /srv/spydir
```

A system account with no login shell, because nothing about this service needs a person to be able
to become it.

**The database lives at `/var/lib/spydir/spydir.db`, outside the deploy tree.** This is the whole
reason `LICENSE_DB` is required and required to be absolute: the default is `./data/spydir.db`,
relative to the working directory, and a deploy that replaces or cleans the checkout takes the list
of every user with it. There is no second copy.

`site/lib/server/store.ts` creates the directory `0700` if it is missing and chmods the database to
`0600` on every open, along with the two files WAL mode keeps beside it:

```
/var/lib/spydir/spydir.db
/var/lib/spydir/spydir.db-wal
/var/lib/spydir/spydir.db-shm
```

Those modes are enforced by the application, not by you, but the *ownership* is yours to get right —
see the warning in *Reserved keys*, which is the one step that routinely creates them as root.

---

## 5. Installing the code and building

The build needs the whole repository, not the `site/` directory. Three things reach outside it:
`site/lib/docs.ts` imports the desktop app's own guide from `src/help/`, `site/lib/releaseNotes.ts`
reads `../content/releases` off disk relative to the working directory, and the guide components
import `lucide-react`, which is a dependency of the **root** `package.json` and is not installed in
`site/node_modules`.

```bash
sudo -u spydir git clone https://github.com/DanteCady/spydr-app.git /srv/spydir/app
sudo -u spydir bash -lc '
  cd /srv/spydir/app
  git checkout main
  npm ci --omit=dev
  cd site
  npm ci
  set -a; . /etc/spydir/build.env; set +a
  npm run build
'
```

`--omit=dev` at the root is worth the flag: it skips Electron and electron-builder, which are a
few hundred megabytes of download the website build has no use for. `lucide-react` is a runtime
dependency there, so it still arrives.

Do all of this **as the `spydir` user**. If you build as root, `.next/` ends up root-owned, and the
service — which writes to `.next/cache` for the image optimiser and the hourly GitHub releases
fetch — fails in ways that look like a Next bug rather than a permissions problem.

Leave `npm run build` as it is. Next 16 builds with Turbopack by default, and the docs pages depend
on it: `src/releases.ts` uses `import.meta.glob` to read the release notes, which Turbopack supports
and webpack does not. Adding `--webpack` breaks the build.

---

## 6. The systemd unit

```bash
sudo tee /etc/systemd/system/spydir.service >/dev/null <<'EOF'
[Unit]
Description=SPYDIR site and licence server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=spydir
Group=spydir
WorkingDirectory=/srv/spydir/app/site
Environment=NODE_ENV=production
EnvironmentFile=/etc/spydir/build.env
EnvironmentFile=/etc/spydir/spydir.env
ExecStart=/usr/bin/node /srv/spydir/app/site/node_modules/next/dist/bin/next start -H 127.0.0.1 -p 4200
Restart=always
RestartSec=5
UMask=0077

NoNewPrivileges=true
PrivateTmp=true
PrivateDevices=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=/var/lib/spydir /srv/spydir/app/site/.next/cache
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectKernelLogs=true
ProtectControlGroups=true
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
LockPersonality=true
SystemCallArchitectures=native
SystemCallFilter=@system-service
MemoryDenyWriteExecute=false
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now spydir
sudo systemctl status spydir
```

Why each of the less obvious lines is there:

- **`WorkingDirectory=…/site`** is load-bearing, not tidiness. `lib/releaseNotes.ts` resolves the
  release notes as `process.cwd()/../content/releases`. Start the process anywhere else and the
  releases page fails at module load.
- **`-H 127.0.0.1`** binds Node to loopback. `next start` defaults to `0.0.0.0`, which on a Lightsail
  box means port 4200 is reachable from the internet the moment someone opens the firewall, entirely
  bypassing nginx — and with it TLS and the `X-Forwarded-For` handling every rate limit depends on.
  The port can also be set through `PORT`, but the hostname has no environment equivalent; it must be
  the flag.
- **`ExecStart` invokes Node directly** rather than `npm start`, so systemd supervises the server
  process itself and `SIGTERM` reaches it rather than an npm wrapper.
- **`Environment=NODE_ENV=production`** is what switches on every refusal in `env.ts`. `next start`
  would set it anyway; stating it means an inherited value cannot quietly disable the checks.
- **`EnvironmentFile` twice**, non-secret first. Both are needed at runtime: `GITHUB_REPO` is read
  when `lib/releases.ts` first loads in the server process.
- **`UMask=0077`** means the database is created owner-only from the outset rather than being
  narrowed a moment later by the chmod in `store.ts`.
- **`ProtectSystem=strict`** makes the entire filesystem read-only, so the two `ReadWritePaths`
  entries are the complete list of what this process may write: the database directory, and
  `.next/cache`, which Next uses for optimised images and for the hourly cached fetch of the GitHub
  releases API. Omit the second and image requests start failing under load with disk errors.
- **`RestrictAddressFamilies`** keeps `AF_UNIX` because journald logging needs it; `AF_INET`/`AF_INET6`
  because the server makes outbound TLS connections for SMTP and the GitHub API.
- **`MemoryDenyWriteExecute=false`** is set explicitly so nobody adds it as `true` later. V8 compiles
  code at runtime and needs writable-executable pages; turning it on stops Node dead.
- **No `DynamicUser`.** The database outlives any single boot and has fixed ownership; a UID that
  changes underneath it would make it unreadable.
- **`Restart=always`** restarts a crashed process, but note what it cannot do: a server with a broken
  environment does not crash. It answers the site normally and returns 500 from `/api/*`. systemd
  will report it healthy indefinitely. The smoke test is how you find that out, not `systemctl`.

---

## 7. nginx and TLS

```bash
sudo tee /etc/nginx/sites-available/spydir >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name spydir.io www.spydir.io;

    # certbot replaces this block with a redirect to 443 and leaves the ACME path working.
    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_http_version 1.1;

        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 60s;
    }

    # No API route accepts a body larger than 8 KiB; refusing bigger ones here saves Node the read.
    client_max_body_size 64k;
}
EOF

sudo ln -sf /etc/nginx/sites-available/spydir /etc/nginx/sites-enabled/spydir
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Then issue the certificate. DNS must already resolve.

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d spydir.io -d www.spydir.io
systemctl list-timers | grep certbot     # renewal is installed by the package
```

### The header line that matters

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

`site/lib/server/guard.ts` decides who a caller is by reading `X-Forwarded-For` and counting
`TRUST_PROXY_HOPS` entries **in from the right**, because each proxy appends and only the right-hand
end was written by infrastructure you control. The left end is whatever the client typed.
`$proxy_add_x_forwarded_for` appends the real peer address, so with `TRUST_PROXY_HOPS=1` the value
the limiter uses is the address nginx observed, and the caller cannot forge past it.

Two ways to break this, both silent:

- **Omitting the header.** `guard.ts` sees fewer entries than there are declared hops, concludes
  nothing is vouched for, and returns `untrusted-proxy` — one bucket shared by the entire internet.
  Every rate limit on the box becomes a single global counter. The site keeps working; the
  protections do not. You will not see an error anywhere.
- **`proxy_set_header X-Forwarded-For $http_x_forwarded_for;`** — passing the client's own header
  through untouched. Now the rightmost entry is also client-supplied, so anyone can pick a fresh
  rate-limit bucket per request. This is the failure that makes every limit decorative, and it looks
  identical to a working configuration from the outside.

Step 10 of the smoke test is the only way to tell the difference from outside. Run it.

### Security headers

Do not add them here. `site/next.config.ts` already sets `Content-Security-Policy`,
`Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` and
`Permissions-Policy` on every response, deliberately in the app so they travel with it and survive a
proxy being rebuilt by someone who never read that file. Duplicating them in nginx risks two
different CSPs, and browsers intersect them, which breaks the site in a way that is hard to trace.

---

## 8. Mail

Signup is a two-step flow — `POST /api/signup` sends a six-digit code, `POST /api/verify` exchanges
it for a key sent by email — so without working mail, nobody gets a key. `lib/server/mail.ts` tries
SMTP first, then `MAIL_WEBHOOK`, then `RESEND_API_KEY`, and if none is configured it reports that
honestly upward so signup answers 503 rather than saying "check your inbox" about a message it never
posted.

Port behaviour, since it is the usual cause of a hanging connection: `465` is treated as implicit
TLS (`secure: true`). Any other port — 587, 25 — connects in the clear and is required to upgrade
through STARTTLS rather than merely offered the chance, so credentials never cross unencrypted.
Connection and greeting timeouts are 10 seconds, the socket timeout 20.

### If you use Amazon SES

**SES accounts start in the sandbox, and a sandboxed account cannot send to anyone who has not
verified their own address with you.** Signup will work for you and fail for every real user, with a
provider-side rejection that arrives in the journal as `[mail] send failed:` and nothing useful to
the person waiting for a code. Before launch, in the SES console:

1. Verify the domain `spydir.io` (not only a single address) and publish the DKIM CNAME records it
   gives you.
2. Publish an SPF record authorising SES, and a DMARC record. A licence key in an unauthenticated
   email is close to the definition of what spam filters exist to catch.
3. Request **production access**, describing what you send and how people opt in. Approval is
   usually a day or so, and is not automatic.
4. Create SMTP credentials — these are not your AWS access keys — and put them in `SMTP_USER` and
   `SMTP_PASS`.
5. Set `MAIL_FROM` to an address on the verified domain. `keys@spydir.io` is the default the code
   falls back to, so it is the sensible one to create.

Use the SES endpoint in the region you verified the domain in; `email-smtp.eu-west-1.amazonaws.com`
in the example above is a placeholder, not a recommendation.

### If you use Resend instead

Set `RESEND_API_KEY` and leave `SMTP_HOST` unset. Domain verification and DKIM are still required —
that is a property of email, not of the provider — but there is no sandbox to escape.

Whichever you choose, test with an address at a mailbox you do not control before you announce
anything. Delivering to yourself proves nothing about whether Gmail accepts the mail.

---

## 9. Reserved keys

Thirty keys are handed out by hand rather than issued by the form: ten `developer` keys at the
`enterprise` tier and twenty `beta` keys at the `team` tier, marked in the database with a
`reserved:` note. They are seeded by `site/scripts/reserved-keys.mjs` against whatever `LICENSE_DB`
points at, so seeding production means running it on the server.

```bash
sudo -u spydir bash -lc '
  cd /srv/spydir/app/site
  LICENSE_DB=/var/lib/spydir/spydir.db \
  KEYS_FILE=/var/lib/spydir/reserved-keys.enc \
  KEYS_PASSPHRASE="<a long passphrase from your password manager>" \
  npm run keys:seed
'
```

Four things to get right here.

**Run it as `spydir`.** The script creates the database and its directory if they do not exist, and
it does so without the `0700`/`0600` modes that `store.ts` applies. Run it as root and the database
ends up root-owned; the service then fails every write with a SQLite "attempt to write a readonly
database" that surfaces to users as signup being broken. If you have already done it, repair with:

```bash
sudo chown spydir:spydir /var/lib/spydir /var/lib/spydir/spydir.db*
sudo chmod 700 /var/lib/spydir
sudo chmod 600 /var/lib/spydir/spydir.db*
sudo systemctl restart spydir
```

**Set `KEYS_FILE`.** It defaults to `keys/reserved-keys.enc` relative to the working directory —
inside the deploy tree, where a fresh clone loses it.

**The passphrase is never stored.** Not in the file, not in the database, not in the repository.
`KEYS_PASSPHRASE` is read only by this script and must not appear in `/etc/spydir/spydir.env`; pass
it on the command line for the one invocation, from a password manager, and store it there
immediately. The output file is AES-256-GCM over a scrypt-derived key and is worthless without it.
Losing it means reseeding, because the database holds only hashes.

**Seeding is idempotent, and reseeding does not rotate.** A key that already exists is left alone
rather than replaced, because rotating one would break whoever is already using it. Running the
script twice is safe; it reports that everything exists and changes nothing.

Read them back, then copy the encrypted file off the box:

```bash
sudo -u spydir bash -lc '
  cd /srv/spydir/app/site
  KEYS_FILE=/var/lib/spydir/reserved-keys.enc KEYS_PASSPHRASE="…" npm run keys:read
'
```

Note that reserved keys are stored without the encrypted copy that `/api/recover` reads, so they
cannot be re-sent by email. That file is the only copy.

---

## 10. Smoke test

Run these in order, from your own machine, against the live domain. Steps 1 to 5 cost nothing.
Steps 6 to 9 issue a real licence key to a real mailbox. Step 10 uses up an hour of one IP
address's signup budget, so it goes last.

**1. The site loads.**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://spydir.io/
```

Expect `200`. A `502` means nginx is up and Node is not — check `systemctl status spydir`.

**2. The app's own security headers survive the proxy.**

```bash
curl -sSI https://spydir.io/ | grep -iE 'content-security-policy|strict-transport-security|x-frame-options'
```

Expect one of each, exactly once. Two `Content-Security-Policy` lines means nginx is adding its own
and the two will be intersected.

**3. `www` and plain HTTP both land on HTTPS.**

```bash
curl -sS -o /dev/null -w '%{http_code} %{url_effective}\n' -L http://www.spydir.io/
```

Expect `200 https://spydir.io/` or `200 https://www.spydir.io/` — either is fine, as long as the
scheme is `https`.

**4. The signing key is real.** This is the single most important check on the page.

```bash
curl -sS https://spydir.io/api/pubkey
```

Expect `"ephemeral": false` and no `note` field. If it says `"ephemeral": true`, `LICENSE_PRIVATE_KEY`
is not reaching the process: the server has generated a throwaway pair at boot, every signature it
makes is unverifiable by any installed copy, and restarting it invalidates everything it has signed
so far. Fix that before going further.

**5. The deployed key is the one the app ships with.** Run from a checkout of this repository, at
the commit whose installers you are publishing:

```bash
curl -sS https://spydir.io/api/pubkey \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>process.stdout.write(JSON.parse(s).publicKey))" \
  > /tmp/deployed-public.pem

diff /tmp/deployed-public.pem resources/license-public.pem && echo "matches the key shipped in the app"
```

Any difference means every activation from every installed copy will be rejected as forged.

**6. Environment validation passed.** This exercises a route that calls `requireProductionEnv`
without sending any mail:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://spydir.io/api/signup \
  -H 'Content-Type: application/json' -d '{"email":"not-an-email"}'
```

Expect `400`. A `500` means the environment check threw — `journalctl -u spydir -n 50` will name the
variable and say why it matters.

**7. Signup sends a code.** Use a mailbox you can read, at a domain you do not own, so this also
tests deliverability.

```bash
curl -sS -X POST https://spydir.io/api/signup \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com"}'
```

Expect `{"status":"sent","expiresInMinutes":10}`, and a six-digit code in that inbox within a minute.
A `503` with "Email is not available right now" means no mail provider is configured. A `502` with
"Could not send the code" means one is configured and the provider refused — SES sandbox is the
usual reason; the journal has the provider's message.

**8. Verify issues the key.** The code lasts ten minutes and allows five wrong guesses.

```bash
curl -sS -X POST https://spydir.io/api/verify \
  -H 'Content-Type: application/json' -d '{"email":"you@example.com","code":"123456"}'
```

Expect `{"status":"ok","hint":"SPYDIR…XXXXX","reissued":false}`. The key itself is never in the
response — it arrives by email, which is what stops anyone who glimpsed the code from walking off
with it. Take the full key from that message.

**9. Activation returns a payload the app can verify.**

```bash
curl -sS -X POST https://spydir.io/api/activate \
  -H 'Content-Type: application/json' \
  -d '{"key":"SPYDIR-XXXXX-XXXXX-XXXXX-XXXXX","machine":"smoke-test","version":"0.1.0","os":"linux"}' \
  > /tmp/activation.json
```

Expect `{"payload":"<base64>","signature":"<base64>"}`. Now check the signature the way the desktop
app does, from a checkout of this repository:

```bash
cat > /tmp/check.cjs <<'EOF'
const { createPublicKey, verify } = require('node:crypto')
const fs = require('node:fs')
const res = JSON.parse(fs.readFileSync('/tmp/activation.json', 'utf8'))
const json = Buffer.from(res.payload, 'base64')
const pub = createPublicKey(fs.readFileSync(process.argv[2], 'utf8'))
console.log(verify(null, json, pub, Buffer.from(res.signature, 'base64')) ? 'VERIFIED' : 'NOT VERIFIED')
console.log(json.toString('utf8'))
EOF
node /tmp/check.cjs resources/license-public.pem
```

Expect `VERIFIED`, followed by the licence: key, email, tier, features, and a `notAfter` thirty days
out. `NOT VERIFIED` means the server's private key and the app's public key are not a pair, and step
5 should have caught it.

**10. Rate limiting is keyed on the real client.** This costs an hour of your own IP's signup budget
and sends no mail, because the limiter runs before the address is validated.

```bash
for i in $(seq 1 11); do
  curl -sS -o /dev/null -w '%{http_code} ' -X POST https://spydir.io/api/signup \
    -H 'Content-Type: application/json' -d '{"email":"not-an-email"}'
done; echo
```

Expect ten `400`s and then a `429`. Now try to escape the bucket by forging the header:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://spydir.io/api/signup \
  -H 'Content-Type: application/json' -H 'X-Forwarded-For: 203.0.113.9' \
  -d '{"email":"not-an-email"}'
```

Expect `429` again. If you get `400`, nginx is handing the client's own `X-Forwarded-For` to Node
instead of appending to it, and every rate limit on this server can be bypassed by setting a header.
Go back to *nginx*.

Clear the limiter when you are finished — it is held in memory, so a restart empties it:

```bash
sudo systemctl restart spydir
```

Finally, delete the test licence so the smoke-test address is not carrying a live key:

```bash
sudo -u spydir sqlite3 /var/lib/spydir/spydir.db \
  "UPDATE licence SET revoked = 1 WHERE email = 'you@example.com';"
```

---

## 11. Backups

### What you are protecting

`/var/lib/spydir/spydir.db` holds every address that has ever registered and, for each one, its
licence key encrypted with `LICENSE_SECRET` — decryptable by design, so that "I lost my key" has an
answer. It also holds activation counts per install and the telemetry table. There is no other copy
anywhere. It is simultaneously the thing you cannot afford to lose and a file you must treat as
personal data.

**Do not store backups and `LICENSE_SECRET` in the same place.** Encrypted keys plus the key that
decrypts them is the same as storing plaintext keys, and the separation is the only thing making an
offsite copy of this file a reasonable thing to have. Backups to object storage, secrets in a
password manager or a secrets manager — never both in the same bucket, and never the environment
file inside the backup archive.

### Taking one

SQLite is in WAL mode, so at any moment the current state is spread across `spydir.db`,
`spydir.db-wal` and `spydir.db-shm`. Copying only the `.db` file while the service is running gives
you a database missing every recent write, and it will not look damaged. Use SQLite's own backup,
which is consistent against a live writer:

```bash
sudo -u spydir sqlite3 /var/lib/spydir/spydir.db \
  ".backup '/var/lib/spydir/backup-$(date -u +%Y%m%dT%H%M%SZ).db'"
```

`.dump` or `VACUUM INTO` are equally safe. `cp` is not.

A daily timer is enough for a database that grows by a handful of rows an hour. Encrypt before it
leaves the box, for instance with `age` or `gpg` to a key held off the instance, then upload to S3
and delete anything older than your retention window locally. Keep the reserved-keys file
(`/var/lib/spydir/reserved-keys.enc`) in the same rotation; it already carries its own encryption and
its own passphrase.

### Restoring

Stop the service first, so nothing is writing while you swap the file:

```bash
sudo systemctl stop spydir
sudo -u spydir cp /path/to/backup.db /var/lib/spydir/spydir.db
sudo rm -f /var/lib/spydir/spydir.db-wal /var/lib/spydir/spydir.db-shm
sudo chown spydir:spydir /var/lib/spydir/spydir.db
sudo chmod 600 /var/lib/spydir/spydir.db
sudo systemctl start spydir
```

Removing the stale WAL and shm files matters: they belong to the database you have replaced.

Rehearse this once, on a throwaway instance, before you need it. A backup you have never restored is
a hypothesis.

---

## 12. Operations

### Logs

```bash
journalctl -u spydir -f                    # the application, including every console.error
journalctl -u spydir --since '1 hour ago'
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

Next writes to stdout, so everything the application says is in the journal. The messages worth
grepping for, all of which are written deliberately because they cannot safely be shown to the
caller:

| Message | Means |
| --- | --- |
| `[signup] no mail provider configured` | `SMTP_HOST`, `MAIL_WEBHOOK` and `RESEND_API_KEY` are all unset. |
| `[mail] send failed:` | A provider is configured and refused or timed out. The reason is here and nowhere else — an SMTP error can reveal whether an address exists, which these flows must not leak. |
| `[recover] a key was requested but …` | Recovery failed for an address that does have a key. |
| `[verify] verified address has a licence whose key cannot be recovered` | A row predating encrypted storage, or `LICENSE_SECRET` has changed. That key must be reissued by hand. |
| `SPYDIR licence server is misconfigured:` | The environment check threw. It names every problem at once. |

### Restarting

```bash
sudo systemctl restart spydir
sudo systemctl reload nginx     # after an nginx change; run nginx -t first
```

A restart clears the in-memory rate limiter, which is occasionally what you want and is also why a
crash loop would let a caller reset their own limits. The global daily caps live in the database and
survive restarts.

### Deploying a new version

```bash
sudo -u spydir bash -lc '
  cd /srv/spydir/app
  git pull --ff-only
  npm ci --omit=dev
  cd site
  npm ci
  set -a; . /etc/spydir/build.env; set +a
  npm run build
'
sudo systemctl restart spydir
```

Then re-run smoke-test steps 1, 4 and 6. Those three take ten seconds and catch the failures a
deploy actually causes.

Two points about this shape. The build happens in place, so there are a few seconds between the
restart and the server answering again; for this service that is acceptable and it keeps
`ReadWritePaths` in the unit pointing at a real directory rather than a symlink that moves underneath
it. And the database is untouched by any of it, because it is not in the deploy tree — which is the
entire argument for `LICENSE_DB` being absolute.

`store.ts` creates missing tables and adds the `key_enc` column if it is absent on first open, so
there is no migration step. That also means a schema change lands on the first request after a
restart rather than during the deploy.

### When signup stops working

Work down this list; it is ordered by how often each is the answer.

1. **Mail.** `journalctl -u spydir --since '1 hour ago' | grep -i mail`. A `502` to the caller means
   the provider refused. With SES, check you are out of the sandbox and that the sending identity is
   still verified — verification can lapse.
2. **The daily cap.** A `503` saying "Key issuing is paused" means more than 5,000 licences were
   created in 24 hours. That is a whole-instance ceiling, not a per-caller one, and it exists so a
   flood cannot fill the disk. Check who is asking before raising it.
3. **Rate limiting.** A `429` from `/api/signup` is ten requests in an hour from one address, or five
   codes sent to one email address. If *everyone* is seeing `429`, the `X-Forwarded-For` handling has
   broken and the whole internet is sharing one bucket — smoke-test step 10 confirms it in one
   command.
4. **The environment check.** A `500` from every API route, with `SPYDIR licence server is
   misconfigured` in the journal. Something edited `/etc/spydir/spydir.env` or the unit stopped
   reading it.
5. **Database permissions.** SQLite errors about a readonly database, usually after someone ran a
   script as root. Repair with the `chown`/`chmod` in *Reserved keys*.
6. **Disk.** `df -h`. The telemetry table is the one that grows; old rows can be deleted freely, as
   nothing reads them back.

To check on a single address without exposing anything:

```bash
sudo -u spydir sqlite3 /var/lib/spydir/spydir.db \
  "SELECT id, tier, created_at, revoked, note FROM licence WHERE email = 'someone@example.com';"
```

Keys are never printed by that query, and they are not recoverable from it — the plaintext exists
only encrypted in `key_enc`, and only `/api/recover` and `/api/verify` will decrypt one, to send it
to the address that owns it and nowhere else.
