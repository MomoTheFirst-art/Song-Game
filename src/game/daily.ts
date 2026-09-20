import type { Difficulty, Song } from './types.ts'

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

/** Songs in one challenge run. */
export const CHALLENGE_LENGTH = 5

/**
 * Draw `count` distinct items at random.
 *
 * Splicing out of a copy is what makes them distinct: indexing a pool at
 * random can return the same item twice, which in a run means one song with
 * two chances at it and in a party means two players sharing a clip.
 */
export function takeRandom<T>(pool: readonly T[], count: number): T[] {
  const bag = pool.slice()
  const out: T[] = []
  for (let i = 0; i < count && bag.length > 0; i++) {
    out.push(...bag.splice(Math.floor(Math.random() * bag.length), 1))
  }
  return out
}

/**
 * A challenge run: five songs drawn from the whole catalogue, any difficulty.
 *
 * Unlike the daily, nothing here is one-per-tier — a run might be three easy
 * songs and two impossible ones, and no two runs feel alike. That also means
 * the no-repeat guarantee has to be enforced rather than inherited: the daily
 * cannot repeat a song because each slot is a different difficulty, whereas
 * this draws every song from one pool.
 *
 * Recently played songs are held back, but never at the cost of a short run:
 * once the unseen pool cannot fill five, the remainder comes from the rest.
 */
export function challengeSongs(
  catalogue: Song[],
  exclude: ReadonlySet<string> = new Set(),
): Song[] {
  const fresh = catalogue.filter((s) => !exclude.has(s.id))
  const picked = takeRandom(fresh, CHALLENGE_LENGTH)
  if (picked.length < CHALLENGE_LENGTH) {
    const seen = new Set(picked.map((s) => s.id))
    const rest = catalogue.filter((s) => !seen.has(s.id))
    picked.push(...takeRandom(rest, CHALLENGE_LENGTH - picked.length))
  }
  return picked
}
