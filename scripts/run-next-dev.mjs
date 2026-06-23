#!/usr/bin/env node
/**
 * Next.js dev avec variables racine (.env) — sans tunnel SSH.
 * Usage : npm run dev:next
 */
import { spawn } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { applyRootEnvToProcess } from './load-root-env.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

applyRootEnvToProcess({ override: true })

const child = spawn('npm', ['run', 'dev', '--prefix', 'next'], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
  cwd: ROOT,
})

child.on('close', (code) => process.exit(code ?? 0))
