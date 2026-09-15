import type { Difficulty, Song } from './types'

/** Difficulty order for the Daily 5 — same sequence every day. */
export const DAILY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'expert', 'impossible']

/** Current date in UTC as YYYY-MM-DD — the daily puzzle key. */
export function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Small deterministic PRNG so every player gets the same puzzle for a date. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Pick one song per difficulty for the given date. Deterministic: the same
 * date and catalogue always produce the same five songs, in DAILY_ORDER.
 */
export function dailySongs(catalogue: Song[], dateKey: string = todayKey()): Song[] {
  const picked: Song[] = []
  for (const difficulty of DAILY_ORDER) {
    const bucket = catalogue.filter((s) => s.difficulty === difficulty)
    if (bucket.length === 0) continue
    // Seed per difficulty so adding songs to one bucket doesn't reshuffle the rest.
    const rng = mulberry32(hashString(`${dateKey}:${difficulty}`))
    picked.push(bucket[Math.floor(rng() * bucket.length)])
  }
  return picked
}

/** Fisher-Yates, on a copy — the caller's array is left alone. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * A random run for Practice mode — one song per difficulty.
 *
 * Plain random picking repeats badly on a small catalogue: with five songs in a
 * tier, one in five runs replays the same track in that slot. Songs in
 * `exclude` (the recently played ones) are skipped, and the tier falls back to
 * its full contents only once everything in it has been seen.
 */
export function practiceSongs(catalogue: Song[], exclude: ReadonlySet<string> = new Set()): Song[] {
  const picked: Song[] = []
  for (const difficulty of DAILY_ORDER) {
    const bucket = catalogue.filter((s) => s.difficulty === difficulty)
    if (bucket.length === 0) continue
    const fresh = bucket.filter((s) => !exclude.has(s.id))
    const pool = fresh.length > 0 ? fresh : bucket
    picked.push(pool[Math.floor(Math.random() * pool.length)])
  }
  return picked
}
