# Roadmap to launch

Everything in v1 is built. This is what stands between it and being sold.

The order is a dependency chain, not a preference: seats need accounts, Stripe needs accounts, and
the paid features need something to gate against. Building them out of order means building the
foundation twice.

## Decisions to make first

These change what gets built, so they are worth settling before the branches are cut.

| Decision | Why it matters |
| --- | --- |
| How many seats does free get? | One machine per key is the obvious answer and probably the wrong one. Admins work from a laptop, a jump box and a VM, and a free tool that locks them out of two of them gets uninstalled rather than upgraded. Two or three free seats, paid for more, is the safer shape. |
| Does Better Auth replace the OTP flow? | Almost certainly yes — its email-OTP plugin covers what `site/lib/server/otp.ts` does, and running both is worse than either. That means the signup flow built this week gets reworked. Real cost, right call. |
| Is `write-operations` dropped? | It is declared in `shared/license.ts` and contradicts the read-only guarantee the product is sold on. Selling "we will fix it for you" undercuts the reason it is safe to point at a production DC. |
| Where does scheduled collection run? | A gMSA-backed Windows service is the enterprise answer and the largest single build here. It is a second executable, not a feature of the desktop app. |

---

## Phase 1 — Foundation

Nothing below this line can start until accounts exist.

### `feat/accounts`
Better Auth with a database adapter over the existing SQLite store.

- [ ] Better Auth installed and wired, with its schema alongside `licence` and `activation`
- [ ] Email + OTP sign-in (its plugin, replacing `lib/server/otp.ts`)
- [ ] Link existing licences to accounts by email — every issued key already has one
- [ ] Sessions, and the rate limiting already in `lib/server/guard.ts` applied to the auth routes
- [ ] Decide what happens to a key issued before accounts existed and never claimed

### `feat/portal`
The signed-in area at `spydir.io/account`.

- [ ] Your licence: key (masked), tier, expiry, seats used
- [ ] Your machines: hostname hash, first seen, last seen, version, platform
- [ ] Release a machine — the other half of seat enforcement, and the support burden if missing
- [ ] Resend the key to yourself
- [ ] Download the current release
- [ ] Billing link through to Stripe's customer portal

---

## Phase 2 — Money

### `feat/stripe`
- [ ] Products and prices in test mode: Free, Team, Enterprise
- [ ] Checkout session from the portal, returning to a success page that waits for the webhook
- [ ] Webhook handler: `checkout.session.completed`, `customer.subscription.updated`, `.deleted`
- [ ] The webhook is what sets `tier`, `features` and `seats` on the licence — never the client
- [ ] Signature verification on the webhook, and idempotency, because Stripe retries
- [ ] Stripe customer portal for card changes and cancellation, so none of that is built here
- [ ] Downgrade path: what happens to seats already in use when a plan shrinks
- [ ] Test-mode clock tests for renewal and failed payment before any live key exists

### `feat/seats`
Today `activation` records a machine per licence with no cap, so one key installs anywhere.

- [ ] `seats` column on `licence`, defaulted by tier
- [ ] `/api/activate` counts distinct live machines and refuses past the cap
- [ ] The refusal names the machines in use — "in use on 2 of 2: DESKTOP-4F2, SRV-JUMP01"
- [ ] Release a machine from the portal, and from Settings in the app
- [ ] A machine not seen in 90 days releases itself, so a dead laptop is not a support ticket
- [ ] Tests for the race: two machines activating the last seat at once

---

## Phase 3 — The features people pay for

Each gates on `hasFeature`, which already exists and nothing currently uses.

### `feat/collector` — the big one
Scheduled reads with no human present. This is what makes everything else worth paying for, and
it is a separate Windows service rather than part of the desktop app.

- [ ] gMSA-backed service: Windows rotates the password, nothing is stored, read-only rights
- [ ] Scheduled crawl writing into the same timeline database the app reads
- [ ] Installer, and a way to verify it is running from inside the app
- [ ] Falls back to a scheduled task under a normal service account where gMSA is not available

### `feat/alerts`
- [ ] Rules: membership of a privileged group changed, a disabled account re-enabled, score dropped by N
- [ ] Email delivery reusing `site/emails/` and the nodemailer transport
- [ ] Digest rather than per-event, with a daily and weekly option
- [ ] Somewhere to see what fired and why

### `feat/scheduled-reports`
- [ ] The existing PDF, generated on a schedule
- [ ] Sent to a list of addresses, not only the licence holder — this is the auditor pull
- [ ] Declared in `shared/license.ts` already

### `feat/multi-domain`
- [ ] More than one directory open, compared side by side
- [ ] Declared already; the snapshot model is already per-domain

### `feat/history-retention`
- [ ] Free keeps 30 days, paid keeps everything
- [ ] `privacy.historyRetentionDays` and `pruneEntries` already exist — this is mostly a cap

### `feat/baseline-drift`
- [ ] Mark a directory state as approved
- [ ] Alert on deviation from it
- [ ] The compliance sale, and it builds on `shared/diff.ts`

### `feat/access-review`
- [ ] Per-group CSV for the group owner to sign off
- [ ] Hooks into the review calendar that already exists in a regulated shop

### `feat/offboarding`
- [ ] Give it a user, get everything they still touch
- [ ] Fits the workflow admins are already in daily

---

## Phase 4 — Before it is public

- [ ] Code signing: Apple Developer Programme, Developer ID cert, notarisation
- [ ] Windows signing certificate (OV or EV; both need hardware since 2023)
- [ ] `spydir.io` registered, DNS, TLS
- [ ] Licence server deployed — see `docs/DEPLOYMENT.md`
- [ ] SMTP live and out of the SES sandbox if SES is chosen
- [ ] Production signing keypair decided — see Decision 1 in `docs/DEPLOYMENT.md`
- [ ] Reserved keys seeded against production
- [ ] Trademark clearance on SPYDIR
- [ ] Terms and a privacy notice, which a paid product needs and a free one got away without

---

## Keep free

Worth stating, because the temptation runs the other way: the hygiene score and Pathfinder stay
free. They are what makes someone like the tool enough to mention it to somebody else, and a
gated first impression has nothing to be word of mouth about.
