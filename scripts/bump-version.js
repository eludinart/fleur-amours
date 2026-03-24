#!/usr/bin/env node
/**
 * Incrémente la version dans next/public/version.json
 * Usage: node scripts/bump-version.js [patch|minor|major]
 *   patch (défaut): 0.1.0 → 0.1.1
 *   minor: 0.1.0 → 0.2.0
 *   major: 0.1.0 → 1.0.0
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VERSION_FILE = resolve(__dirname, '../next/public/version.json')

const bump = process.argv[2] || 'patch'

const data = JSON.parse(readFileSync(VERSION_FILE, 'utf8'))
const oldVersion = data.version || '0.1.0'
const [major, minor, patch] = oldVersion.split('.').map(Number)

let newVersion
if (bump === 'major') {
  newVersion = `${major + 1}.0.0`
} else if (bump === 'minor') {
  newVersion = `${major}.${minor + 1}.0`
} else {
  newVersion = `${major}.${minor}.${(patch || 0) + 1}`
}

data.version = newVersion
writeFileSync(VERSION_FILE, JSON.stringify(data, null, 0) + '\n', 'utf8')
console.log(`Version: ${oldVersion} → ${newVersion}`)
