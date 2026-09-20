---
name: connect-onprem-ad
description: On-prem AD connect wizard for Spydir — DC discovery, LDAP/LDAPS/StartTLS, UPN bind, rootDSE base DN, and admin error copy. Use when changing Connect, discoverDc, ldap bind, or connection profiles.
---

# Connect on-prem AD

## Admin paths

1. Domain-joined Windows: prefill `USERDNSDOMAIN` and `LOGONSERVER` (strip leading `\\`).
2. VPN / Mac / non-domain: domain FQDN → SRV `_ldap._tcp.dc._msdcs.<domain>`, or paste DC host/IP.
3. No DC: Open sample directory (fixture). Always available.

## Bind (v1)

- Simple bind: UPN or `DOMAIN\user`. Do not require Domain Admin.
- Protocol: LDAPS 636 default recommendation; LDAP 389 and StartTLS supported.
- Trust-self-signed toggle off by default.
- Blank base DN → `defaultNamingContext` from rootDSE after bind.

## Errors

Map to: unreachable (VPN/firewall), bad credentials, TLS trust, timeout. Never echo the password.

## Not v1

Current-user SSPI/Kerberos bind. Global Catalog as the primary connection.
