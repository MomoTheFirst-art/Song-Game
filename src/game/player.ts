/**
 * Who is playing.
 *
 * A name chosen on the device, with an id so scores can attach to it. This
 * began as a fallback for when the backend was unreachable; that backend is gone
 * and it is now the only identity there is, which is also the whole of what
 * the game needs — a score with a name on it.
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
