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

/** A random run for Practice mode — one song per difficulty, unseeded. */
export function practiceSongs(catalogue: Song[]): Song[] {
  const picked: Song[] = []
  for (const difficulty of DAILY_ORDER) {
    const bucket = catalogue.filter((s) => s.difficulty === difficulty)
    if (bucket.length === 0) continue
    picked.push(bucket[Math.floor(Math.random() * bucket.length)])
  }
  return picked
}
