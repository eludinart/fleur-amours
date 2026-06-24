/** Filtres serveur pour exclure les comptes démo Mycelium des listes d'utilisateurs. */
import type { RowDataPacket } from 'mysql2'
import { getPool, table } from './db'
import { excludeDemoAccountsSql, isVirtualAccount } from './demo-accounts'

export { isVirtualAccount }

/** Retire les comptes virtuels d'une liste de destinataires (e-mail connu). */
export function filterOutVirtualRecipients<T extends { user_id: number; email: string }>(
  recipients: T[],
): T[] {
  return recipients.filter((r) => !isVirtualAccount({ email: r.email }))
}

/** Retire les IDs de comptes démo d'une liste (liens sociaux, etc.). */
export async function filterOutDemoUserIds(userIds: number[]): Promise<number[]> {
  if (userIds.length === 0) return []
  const pool = getPool()
  const tUsers = table('users')
  const tMeta = table('usermeta')
  const placeholders = userIds.map(() => '?').join(',')
  const [rows] = await pool.execute<RowDataPacket[]>(
    `SELECT u.ID FROM ${tUsers} u
     WHERE u.ID IN (${placeholders})
     ${excludeDemoAccountsSql('u', tMeta)}`,
    userIds
  )
  const keep = new Set(rows.map((r) => Number(r.ID)))
  return userIds.filter((id) => keep.has(id))
}
