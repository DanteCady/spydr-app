# Spydr AD lab

A throwaway Samba Active Directory domain controller in Docker, seeded as **Harborview Logistics**:
a plausible mid-size company directory with the kind of accumulated mess real domains have. Use it
to exercise Spydr without touching a production domain. Works on Apple silicon and x86.

```bash
npm run lab:up      # build the image and start the DC (first provision takes ~1 min)
npm run lab:seed    # create the Harborview OUs, people, groups, nesting, and leftovers
npm run lab:verify  # ingest through Spydr's LDAP provider and print findings + hygiene score
npm run lab:logs    # follow the DC log
npm run lab:down    # stop (data persists)   ·   npm run lab:reset  # stop and wipe
```

## Connect from Spydr

| Field | Value |
| --- | --- |
| Domain FQDN | `harborview.local` |
| Domain controller | `127.0.0.1` |
| Protocol / port | LDAPS / 636 (LDAP 389 and StartTLS also work) |
| User | `HARBORVIEW\Administrator` (any seeded user works too, e.g. `HARBORVIEW\jchen`) |
| Password | `Harbor!Lab2026` |
| Trust this server's certificate | on (self-signed) |
| Base DN | leave blank (rootDSE) |

## What is seeded

An OU tree (`Harborview` → Users by department, Groups by kind, Service Accounts, Servers,
Workstations by site, Disabled Users, Contractors), 31 people, 6 service accounts, 16 computers,
and ~45 groups with deliberately inconsistent naming (`SG-`, `GG_`, `DL-`, plain names, legacy).

The mess the engine should surface:

- **Escalation:** `SG-IT-Tier1 → SG-IT-Helpdesk → SG-IT-ServerAdmins → SG-IT-Tier0 → Domain Admins`.
  A network contractor (`ext.jbauer`) sits four hops from Domain Admins; `svc-backup` is a direct member.
- **Redundant memberships:** `kowens`, `rgoldberg`, `bwilliams`, `arossi` are direct members of groups
  they also reach through nesting.
- **Distribution lists granting access:** `Finance Team` inside `DL-FS-Finance-RO`.
- **Legacy tangle:** a five-group chain from the 2019 migration that also closes a loop
  (`Old_Exchange_Users → Acme_Migration_Temp → Citrix_Admins_2016 → Citrix_Users_2016 → FS01_Share_Admins → FS01_Share_Users → Old_Exchange_Users`),
  and `Old_Exchange_Users` still on the HR confidential share.
- **Disabled but still in groups:** `pmiller` (ex-sysadmin, still in VPN and backup groups),
  `sgreen` (ex-accountant, still in Finance), `svc-citrix`, `ext.mliu`.
- **Stale:** contractors and legacy service accounts never logged on. Current staff get a real logon
  during seeding so they are not flagged.
- **Empty groups:** several `DL-Print-*`/legacy groups end up empty, plus the built-in
  Enterprise/Schema Admins.

Reseeding is safe; the script skips anything that already exists.
