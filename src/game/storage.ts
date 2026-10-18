import type { Mode } from './types.ts'

const KEY = 'song-game:v1'

export interface DayRecord {
  dateKey: string
  score: number
  /** Stage each round was solved at, or null if lost. */
  stages: (number | null)[]
}

/** One finished run, for the player's own history. */
export interface RunRecord {
  dateKey: string
  mode: Mode
  genre: string
  score: number
}

interface Store {
  lastDaily?: DayRecord
  /** Song ids seen recently, newest last — keeps practice runs from repeating. */
  recent?: string[]
  /** Finished runs, newest last. */
  runs?: RunRecord[]
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

/** Runs kept for the history page. Older ones are not worth the storage. */
const RUN_LIMIT = 50

/**
 * Remember a finished run so the player can see their own history.
 *
 * Every run, not just the daily: saveRun exists to stop the daily being
 * replayed and deliberately ignores the rest, which is a different job.
 */
export function recordRun(run: RunRecord): void {
  const store = read()
  write({ ...store, runs: [...(store.runs ?? []), run].slice(-RUN_LIMIT) })
}

/** Finished runs, newest first. */
export function loadRuns(): RunRecord[] {
  return [...(read().runs ?? [])].reverse()
}

export function bestScore(): number {
  return (read().runs ?? []).reduce((best, r) => Math.max(best, r.score), 0)
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
