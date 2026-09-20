#!/usr/bin/env node
/**
 * The read-only promise, enforced by the build rather than by everyone remembering.
 *
 * "SPYDIR never writes to Active Directory" is the reason it is safe to point at a production
 * domain controller with domain administrator credentials, and it is the first thing anyone
 * evaluating it asks about. A promise that rests on reviewers noticing is not a promise; it is a
 * habit, and habits lapse quietly. This fails the build the day one lapses.
 *
 * Two things are checked.
 *
 * Every ldapts client is found by where it is constructed, so the check follows a rename rather
 * than assuming the variable is called `client`. Anything but bind, search, startTLS and unbind
 * on one of those is a write.
 *
 * And nothing anywhere may reach for a child process. SPYDIR has no business running a command,
 * and an app that can shell out can do anything the shell can — including the writes this file
 * exists to prevent.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROOTS = ['electron', 'shared', 'src']
const EXTENSIONS = /\.(ts|tsx|js|mjs|cjs)$/

/** The only operations a read-only directory reader performs. */
const ALLOWED = new Set(['bind', 'search', 'searchPaginated', 'startTLS', 'unbind', 'isConnected'])

const failures = []

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (EXTENSIONS.test(name)) out.push(full)
  }
  return out
}

for (const base of ROOTS) {
  for (const file of walk(join(root, base))) {
    const source = readFileSync(file, 'utf8')
    const where = relative(root, file)

    // A child process is a way around every other rule in this file.
    for (const pattern of [/child_process/, /\bexecFile\s*\(/, /\bspawnSync\s*\(/, /\bexecSync\s*\(/]) {
      if (pattern.test(source)) {
        failures.push(`${where}: reaches for a child process (${pattern.source}). SPYDIR does not run commands.`)
      }
    }

    // Find each ldapts client by its construction, so renaming the variable does not escape this.
    const clients = [...source.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+Client\s*\(/g)].map(
      (m) => m[1]
    )

    for (const name of clients) {
      const calls = [...source.matchAll(new RegExp(`\\b${name}\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g'))]
      for (const call of calls) {
        const method = call[1]
        if (ALLOWED.has(method)) continue
        const line = source.slice(0, call.index).split('\n').length
        failures.push(
          `${where}:${line}: ${name}.${method}() is not a read. SPYDIR v1 performs no LDAP writes — ` +
            `allowed operations are ${[...ALLOWED].join(', ')}.`
        )
      }
    }
  }
}

if (failures.length > 0) {
  console.error('\nThe read-only guarantee is broken:\n')
  for (const failure of failures) console.error(`  ${failure}`)
  console.error(
    '\nIf a write is genuinely intended, that is a product decision and a change to what SPYDIR is —\n' +
      'update AGENTS.md, the About article and the site copy in the same change, then widen the\n' +
      'allow-list in scripts/assert-read-only.mjs deliberately rather than in passing.\n'
  )
  process.exit(1)
}

console.log('Read-only: no LDAP writes, no child processes.')
