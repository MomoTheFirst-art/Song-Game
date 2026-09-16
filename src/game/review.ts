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
 * What the game is allowed to play.
 *
 * A rejected clip is never played — that is the whole point of reviewing. But
 * gating strictly on approval would empty the game the moment reviewing began,
 * so unreviewed songs keep playing until enough approvals exist to field a run
 * on their own; from then on, approved songs are the game.
 */
export function playableSongs(all: Song[], decisions: Decisions): Song[] {
  const withClips = all.filter((s) => Boolean(s.previewUrl))
  const approved = withClips.filter((s) => verdictFor(s, decisions) === 'approved')
  if (canFieldRun(approved)) return approved
  return withClips.filter((s) => verdictFor(s, decisions) !== 'rejected')
}

/** True once approvals alone carry the game, so the UI can say so. */
export function approvalsGovern(all: Song[], decisions: Decisions): boolean {
  const approved = all.filter(
    (s) => s.previewUrl && verdictFor(s, decisions) === 'approved',
  )
  return canFieldRun(approved)
}
