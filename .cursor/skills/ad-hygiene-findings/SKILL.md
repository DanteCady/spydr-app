---
name: ad-hygiene-findings
description: Spydr hygiene finding detectors and suggested-fix text. Use when adding or changing findings, Hygiene cockpit, or the inspector Spydr tab.
---

# Hygiene findings

Each finding: `id`, `type`, `severity`, `title`, `objectIds`, `detail`, `suggestedFix` (text only, never an AD write).

Detectors (all required):

1. `circular-nesting` — cycles in the group graph
2. `deep-nesting` — group ancestor depth > N (default 3)
3. `empty-security-group` — security group with no members
4. `disabled-in-group` — disabled users still in groups (ignore primary Domain Users if that is the only edge)
5. `stale-in-group` — lastLogon older than 90 days (or never) and still in groups
6. `redundant-membership` — user directly in group G and in a nested descendant of G
7. `privileged-nested-path` — users who reach Domain Admins / Enterprise Admins / Schema Admins / Administrators via nesting
8. `distribution-in-security` — distribution group nested into a security group

Suggested fix is prose an admin can do in ADUC. Do not add an Apply button.
