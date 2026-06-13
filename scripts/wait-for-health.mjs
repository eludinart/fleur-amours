#!/usr/bin/env node
/** Attend qu'un endpoint health réponde 200. Usage: node scripts/wait-for-health.mjs [url] */
const url = process.argv[2] || 'http://127.0.0.1:3001/jardin/api/health'
const maxMs = Number(process.argv[3] || 120_000)
const start = Date.now()

async function tick() {
  try {
    const res = await fetch(url)
    if (res.ok) {
      console.log(`Health OK: ${url}`)
      process.exit(0)
    }
  } catch { /* retry */ }
  if (Date.now() - start > maxMs) {
    console.error(`Timeout waiting for ${url}`)
    process.exit(1)
  }
  setTimeout(tick, 2000)
}

tick()
