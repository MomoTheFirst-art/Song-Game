import { DAILY_ORDER } from './daily.ts'
import type { Song } from './types.ts'

export type Verdict = 'approved' | 'rejected'

/**
 * A verdict is about a clip, not a song. Recording which clip it judged means a
 * re-fetched song comes back as unreviewed instead of inheriting a verdict
 * passed on audio that no longer exists.
 */
export interface Decision {
  verdict: Verdict
  clip: string
}

export type Decisions = Record<string, Decision>

const KEY = 'song-game:verdicts:v2'
const LEGACY_KEY = 'song-game:verdicts:v1'

export function loadDecisions(): Decisions {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Decisions
    // v1 stored a bare verdict with no record of the clip judged, so there is
    // no way to tell whether it still applies. Those verdicts are already
    // committed to the catalogue, so dropping them loses nothing and clears
    // the stale rejections that were hiding re-fetched songs.
    if (localStorage.getItem(LEGACY_KEY)) localStorage.removeItem(LEGACY_KEY)
    return {}
  } catch {
    return {}
  }
}

export function saveDecisions(d: Decisions): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d))
  } catch {
    // Storage unavailable — decisions last for this session only.
  }
}

/**
 * A song's standing: a local review wins over whatever was committed — but only
 * while it still describes the clip on offer. A song whose audio was replaced
 * is unreviewed again, whatever was said about the clip it used to have.
 */
export function verdictFor(song: Song, decisions: Decisions): Verdict | undefined {
  const local = decisions[song.id]
  if (local && local.clip === song.previewUrl) return local.verdict
  if (song.approved === true) return 'approved'
  if (song.approved === false) return 'rejected'
  return undefined
}

/** Enough approved songs to field a full run — one per difficulty tier. */
export function canFieldRun(approved: Song[]): boolean {
  return DAILY_ORDER.every((tier) => approved.some((s) => s.difficulty === tier))
}

/**
 * What the game is allowed to play: approved clips, and nothing else.
 *
 * This used to let unreviewed songs play until enough approvals existed to
 * field a run, so that reviewing a fresh catalogue did not empty the game
 * while it was under way. That bootstrap is what let a lookup put audio in
 * front of players before anyone had heard it — and with a catalogue per
 * genre it fired on every new one, which is exactly backwards: a brand new
 * catalogue is the one least worth trusting unheard.
 *
 * Every song now takes the same route, whatever file it lives in: matched,
 * reviewed, approved, played.
 */
export function playableSongs(all: Song[], decisions: Decisions): Song[] {
  return all.filter(
    (s) => Boolean(s.previewUrl) && verdictFor(s, decisions) === 'approved',
  )
}

/** Clips waiting on a verdict — what the home screen counts to explain itself. */
export function awaitingReview(all: Song[], decisions: Decisions): number {
  return all.filter((s) => s.previewUrl && verdictFor(s, decisions) === undefined).length
}
