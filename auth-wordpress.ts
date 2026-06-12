/**
 * Vérification des mots de passe WordPress (MariaDB).
 * Supporte : bcrypt, argon2, phpass ($P$, $H$), $wp$ (WordPress 6.5+), MD5 legacy.
 */
import { compare } from 'bcryptjs'
import { createHash, createHmac } from 'crypto'

const ITOA64 = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

/** WordPress phpass ($P$, $H$) — compatibilité tables wp_users */
function phpassCheckPassword(password: string, storedHash: string): boolean {
  if (password.length > 4096) return false
  if (!storedHash.startsWith('$P$') && !storedHash.startsWith('$H$')) return false

  const id = storedHash.substring(0, 3)
  const countLog2Idx = ITOA64.indexOf(storedHash[3])
  if (countLog2Idx < 7 || countLog2Idx > 30) return false

  const count = 1 << countLog2Idx
  const salt = storedHash.substring(4, 12)
  if (salt.length !== 8) return false

  let hash = createHash('md5').update(salt + password, 'binary').digest('binary')
  for (let i = 0; i < count - 1; i++) {
    hash = createHash('md5').update(hash + password, 'binary').digest('binary')
  }

  const encoded = encode64(hash, 16)
  const computed = storedHash.substring(0, 12) + encoded
  return computed === storedHash
}

function encode64(input: string, count: number): string {
  let output = ''
  let i = 0
  const buf = Buffer.from(input, 'binary')
  do {
    let value = buf[i++] ?? 0
    output += ITOA64[value & 0x3f]
    if (i < count) value |= (buf[i] ?? 0) << 8
    output += ITOA64[(value >> 6) & 0x3f]
    if (i++ >= count) break
    if (i < count) value |= (buf[i] ?? 0) << 16
    output += ITOA64[(value >> 12) & 0x3f]
    if (i++ >= count) break
    output += ITOA64[(value >> 18) & 0x3f]
  } while (i < count)
  return output
}

/**
 * Vérifie un mot de passe contre un hash WordPress.
 */
export async function verifyWordPressPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false

  // WordPress 6.5+ : $wp$ = bcrypt with HMAC-SHA384 pre-hash
  if (storedHash.startsWith('$wp$')) {
    const bcryptHash = storedHash.substring(3)
    const preHashed = createHmac('sha384', 'wp-sha384').update(password).digest('base64')
    return compare(preHashed, bcryptHash)
  }

  // Standard bcrypt / argon2
  if (/^\$(2[aby]|argon2)/.test(storedHash)) {
    return compare(password, storedHash)
  }

  // phpass portable ($P$, $H$)
  if (storedHash.startsWith('$P$') || storedHash.startsWith('$H$')) {
    return phpassCheckPassword(password, storedHash)
  }

  // Legacy MD5 (32 hex chars)
  if (storedHash.length === 32 && /^[a-f0-9]{32}$/i.test(storedHash)) {
    const md5 = createHash('md5').update(password).digest('hex')
    return md5 === storedHash.toLowerCase()
  }

  return false
}
