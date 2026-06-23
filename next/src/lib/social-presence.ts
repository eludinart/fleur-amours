/** Présence sociale : actif si heartbeat/API dans les N dernières secondes (UTC). */
export const PRESENCE_ONLINE_SECONDS = 300

export function parseSocialLastSeenAt(lastSeenAt: string): number | null {
  if (!lastSeenAt) return null
  const s = String(lastSeenAt).trim()
  if (!s) return null

  let ts: number
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s.replace(' ', 'T') + 'Z').getTime()
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    ts = new Date(s + 'Z').getTime()
  } else {
    ts = new Date(s).getTime()
  }
  return Number.isFinite(ts) ? ts : null
}

/** Vrai seulement si la dernière activité est dans la fenêtre récente (pas dans le futur). */
export function isOnlineFromLastSeen(lastSeenAt: string, nowMs = Date.now()): boolean {
  const ts = parseSocialLastSeenAt(lastSeenAt)
  if (ts == null) return false
  const ageSec = (nowMs - ts) / 1000
  return ageSec >= 0 && ageSec <= PRESENCE_ONLINE_SECONDS
}
