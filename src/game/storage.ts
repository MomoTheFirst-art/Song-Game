import type { Mode } from './types.ts'

const KEY = 'song-game:v1'

export interface DayRecord {
  dateKey: string
  score: number
  /** Stage each round was solved at, or null if lost. */
  stages: (number | null)[]
}

interface Store {
  lastDaily?: DayRecord
  /** Song ids seen recently, newest last — keeps practice runs from repeating. */
  recent?: string[]
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Store
  } catch {
    // Private windows and blocked site data both land here — play on without stats.
    return {}
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable; the run still completes, it just isn't remembered.
  }
}

export function loadDaily(dateKey: string): DayRecord | null {
  const { lastDaily } = read()
  return lastDaily && lastDaily.dateKey === dateKey ? lastDaily : null
}

export function saveRun(mode: Mode, record: DayRecord): void {
  if (mode !== 'daily') return
  write({ ...read(), lastDaily: record })
}

/** How many past songs the randomiser avoids before allowing a repeat. */
const RECENT_LIMIT = 40

export function recentlyPlayed(): Set<string> {
  return new Set(read().recent ?? [])
}

export function rememberPlayed(ids: string[]): void {
  const store = read()
  const recent = [...(store.recent ?? []).filter((id) => !ids.includes(id)), ...ids]
  write({ ...store, recent: recent.slice(-RECENT_LIMIT) })
}
