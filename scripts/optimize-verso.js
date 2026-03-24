#!/usr/bin/env node
/**
 * Réduit verso-cartes pour le web (600px largeur, WebP 85%)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const src = resolve(ROOT, 'next/public/verso-cartes.png')
const outWebp = resolve(ROOT, 'next/public/verso-cartes.webp')
const outPng = resolve(ROOT, 'next/public/verso-cartes.png')

if (!existsSync(src)) {
  console.error('❌ verso-cartes.png introuvable dans next/public/')
  process.exit(1)
}

const sharp = (await import('sharp')).default
const buf = readFileSync(src)
const meta = await sharp(buf).metadata()
const w = meta.width || 0
const h = meta.height || 0

const maxW = 600
const scale = w > maxW ? maxW / w : 1
const newW = Math.round(w * scale)
const newH = Math.round(h * scale)

const resized = sharp(buf).resize(newW, newH, { fit: 'inside' })

const [webp, png] = await Promise.all([
  resized.clone().webp({ quality: 85 }).toBuffer(),
  resized.clone().png({ compressionLevel: 9 }).toBuffer(),
])

writeFileSync(outWebp, webp)
writeFileSync(outPng, png)
console.log(`✅ verso-cartes: ${w}x${h} → ${newW}x${newH}`)
console.log(`   WebP: ${(webp.length/1024).toFixed(0)}KB | PNG: ${(png.length/1024).toFixed(0)}KB`)
