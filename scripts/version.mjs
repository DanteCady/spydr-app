#!/usr/bin/env node
/**
 * Bump the version and open a place to write the notes for it.
 *
 * SPYDR's version is stated once, in package.json, and everything else reads it from there — the
 * About screen, the licence check, the telemetry payload, the site's download cards. The one
 * thing that cannot be derived is what changed, so this creates the file for it and leaves it for
 * a person to fill in. A release with no notes fails `npm test`, which is deliberate: notes
 * written a week later are written from the commit log, and the commit log is not what a customer
 * needs to read.
 *
 *   npm run version:bump patch     0.1.0 -> 0.1.1
 *   npm run version:bump minor     0.1.0 -> 0.2.0
 *   npm run version:bump major     0.1.0 -> 1.0.0
 *   npm run version:bump 0.4.2     an exact version
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgPath = join(root, 'package.json')

const argument = process.argv[2]
if (!argument) {
  console.error('Say what to bump: patch, minor, major, or an exact version like 0.4.2')
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const current = pkg.version

function next(from, how) {
  const exact = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(how)
  if (exact) return `${Number(exact[1])}.${Number(exact[2])}.${Number(exact[3])}`

  const parts = from.split('.').map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    console.error(`package.json version "${from}" is not a three-part version.`)
    process.exit(1)
  }
  const [major, minor, patch] = parts
  if (how === 'major') return `${major + 1}.0.0`
  if (how === 'minor') return `${major}.${minor + 1}.0`
  if (how === 'patch') return `${major}.${minor}.${patch + 1}`

  console.error(`"${how}" is not patch, minor, major, or a version like 0.4.2`)
  process.exit(1)
}

const version = next(current, argument)
const notesPath = join(root, 'content', 'releases', `${version}.md`)

if (existsSync(notesPath)) {
  console.error(`content/releases/${version}.md already exists — pick another version or edit that one.`)
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
const template = `---
version: "${version}"
date: "${today}"
title: ""
summary: ""
---

### Platform
- **New:**
`

pkg.version = version
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
writeFileSync(notesPath, template, 'utf8')

console.log(`${current} -> ${version}`)
console.log('')
console.log(`  package.json               updated`)
console.log(`  content/releases/${version}.md  created — write the notes before committing`)
console.log('')
console.log('Categories: Directory, Hygiene, Pathfinder, Web, Timeline, Reports, Settings, Platform')
console.log('Bullets:    **New:**, **Improved:**, **Fixed:**')
