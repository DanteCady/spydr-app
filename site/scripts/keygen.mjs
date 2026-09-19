#!/usr/bin/env node
import { generateKeyPairSync } from 'node:crypto'

/**
 * Generates the licence signing pair. The private half goes in the server environment; the public
 * half is embedded in the desktop app so it can verify a cached activation offline.
 */
const { privateKey, publicKey } = generateKeyPairSync('ed25519')
const priv = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
const pub = publicKey.export({ type: 'spki', format: 'pem' }).toString()

console.log('# Server — set this in the environment (keep it secret):\n')
console.log(`LICENSE_PRIVATE_KEY="${priv.trim().replace(/\n/g, '\\n')}"\n`)
console.log('# Desktop app — save as resources/license-public.pem and commit it:\n')
console.log(pub)
