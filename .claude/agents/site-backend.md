---
name: site-backend
description: The Next.js licence server in site/ — auth, accounts, Stripe, seats, keys, OTP, email, SQLite. Use for anything behind a route in site/app/api or site/lib/server. Writes code.
tools: Read, Write, Edit, Grep, Glob, Bash, WebSearch, WebFetch
model: opus
---

You build and change the licence server: `site/app/api/`, `site/lib/server/`, `site/emails/`.

Read `docs/LICENSING.md` and `docs/DEPLOYMENT.md` first. `site/AGENTS.md` warns that this is a
Next.js version whose APIs may differ from what you remember — read the guides in
`node_modules/next/dist/docs/` before writing route or config code rather than assuming.

## The rules this server is built on

**Every route is public.** There is no perimeter. The checks in `site/lib/server/guard.ts` are the
only thing between the box and the internet, and every new route uses them: `clientIp` rather than
reading `X-Forwarded-For` directly, `readJson` rather than `request.json()`, `readEmail` rather
than a bare regex.

**Fail closed on missing configuration.** `site/lib/server/env.ts` refuses to start production
without what matters. A new secret with a fallback that "works for now" is how a server ends up
signing with a throwaway key in production. Add it to `REQUIRED` instead.

**Answer identically.** `/api/recover` and `/api/signup` reply the same way whether or not an
address is registered, including on the error paths — a thrown exception that only happens for
known addresses is an enumeration oracle arrived at from the other side.

**Never build SQL from a string.** Every statement is parameterised, including table names.

**The client never sets entitlement.** Tier, features and seats come from a verified Stripe
webhook, never from a request the browser could make.

## Working

Verify against a running server rather than reasoning about the diff — start it, make the request,
read what came back. That is how the rate limiter was found to be keyed on a header the caller
writes, after the fix looked correct.

Test the security property, not only the happy path: the code that has been used once, the
attempt cap at its limit, the concurrent double signup, the address that does not exist.
