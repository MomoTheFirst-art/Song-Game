import type { Mode } from './types'

const KEY = 'song-game:v1'

export interface DayRecord {
  dateKey: string
  score: number
  /** Stage each round was solved at, or null if lost. */
  stages: (number | null)[]
}

interface Store {
  lastDaily?: DayRecord
  history: DayRecord[]
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { history: [] }
    const parsed = JSON.parse(raw) as Store
    return { ...parsed, history: parsed.history ?? [] }
  } catch {
    // Private windows and blocked site data both land here — play on without stats.
    return { history: [] }
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
  const store = read()
  const history = store.history.filter((d) => d.dateKey !== record.dateKey)
  history.push(record)
  write({ lastDaily: record, history: history.slice(-365) })
}

export function stats(): { played: number; best: number; average: number } {
  const { history } = read()
  if (history.length === 0) return { played: 0, best: 0, average: 0 }
  const scores = history.map((d) => d.score)
  const total = scores.reduce((a, b) => a + b, 0)
  return {
    played: history.length,
    best: Math.max(...scores),
    average: Math.round(total / history.length),
  }
}
