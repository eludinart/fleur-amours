#!/usr/bin/env node
/**
 * Donne les droits admin à un utilisateur par email.
 * Usage: npm run grant-admin [email]  (depuis racine, délègue à next/)
 *        cd next && npm run grant-admin [email]
 */
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const nextDir = resolve(__dirname, 'next')
const script = resolve(nextDir, 'scripts/grant-admin.js')

const child = spawn('node', [script, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: nextDir,
})

child.on('close', (code) => process.exit(code ?? 0))
