import { STAGES } from './stages.ts'
import type { Song } from './types.ts'

/** An Apple preview is 30 seconds — nothing may be scheduled past its end. */
const PREVIEW_SECONDS = 30

/**
 * The latest a clip may begin and still have the longest stage fit inside the
 * preview. Starting at 20s would leave a 15s stage with only ten seconds of
 * audio and silence after it.
 */
export const MAX_START = PREVIEW_SECONDS - STAGES[STAGES.length - 1]

/** Half-second steps: finer than that is below what the ear places anyway. */
export const clampStart = (seconds: number): number =>
  Math.min(MAX_START, Math.max(0, Math.round(seconds * 2) / 2))

export type Starts = Record<string, number>

const KEY = 'song-game:starts:v1'

export function loadStarts(): Starts {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Starts) : {}
  } catch {
    return {}
  }
}

export function saveStarts(starts: Starts): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(starts))
  } catch {
    // Storage unavailable — the overrides last for this session only.
  }
}

/**
 * A locally chosen start point wins over the one the catalogue ships, so the
 * admin hears their own change in the game without a deploy. Clamped on the way
 * through: a stored value from an older build must not outlive its bounds.
 */
export function withStarts(songs: Song[], starts: Starts): Song[] {
  return songs.map((s) =>
    s.id in starts ? { ...s, startAt: clampStart(starts[s.id]) } : s,
  )
}
