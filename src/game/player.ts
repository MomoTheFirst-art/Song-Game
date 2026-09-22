/**
 * Who is playing, whether or not a backend exists.
 *
 * The game is behind a name gate, and that gate must not depend on a cloud
 * project being finished. If Firebase is unreachable — unconfigured, offline,
 * or with anonymous sign-in not yet switched on — a player still picks a name
 * and still plays; their scores are simply kept on the device instead of in
 * Firestore.
 *
 * The alternative was a live site that nobody, including its owner, can get
 * into because of a console toggle. A game should not be one setting away
 * from unplayable.
 */
const KEY = 'song-game:player:v1'

export interface LocalPlayer {
  id: string
  name: string
}

function makeId(): string {
  // crypto.randomUUID is unavailable over plain http and in older browsers,
  // and this only has to be unique on one device.
  try {
    return `local-${crypto.randomUUID()}`
  } catch {
    return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  }
}

export function loadLocalPlayer(): LocalPlayer | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocalPlayer>
    if (!parsed.id || !parsed.name) return null
    return { id: parsed.id, name: parsed.name }
  } catch {
    return null
  }
}

export function saveLocalPlayer(name: string): LocalPlayer {
  const existing = loadLocalPlayer()
  const player = { id: existing?.id ?? makeId(), name: name.trim() }
  try {
    localStorage.setItem(KEY, JSON.stringify(player))
  } catch {
    // Private mode: the name lasts for this tab only, which still beats
    // refusing to let anyone play.
  }
  return player
}

export function clearLocalPlayer(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing stored, nothing to clear.
  }
}
