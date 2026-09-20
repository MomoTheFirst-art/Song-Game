export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'impossible'

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'سهل',
  medium: 'متوسط',
  hard: 'صعب',
  expert: 'خبير',
  impossible: 'مستحيل',
}

export interface Song {
  id: string
  title: string
  titleLatin: string
  artist: string
  artistLatin: string
  year: number
  difficulty: Difficulty
  /**
   * 30-second preview, filled in by scripts/fetch-previews.mjs. This is the
   * only audio source: a song without one cannot be played and is skipped.
   */
  previewUrl?: string
  /** Cover art URL, recorded alongside a preview. */
  artwork?: string
  /** Pins the lookup to an exact query when the derived ones find the wrong recording. */
  searchAs?: string
  /**
   * Given up on: rejected after two separate lookups across five store fronts.
   * The fetch script skips these rather than resurfacing the same wrong clips.
   */
  retired?: boolean
  /**
   * Committed verdict from clip review. Absent means unreviewed. A reviewer's
   * local decision overrides this until it is committed back to the catalogue.
   */
  approved?: boolean
  /**
   * What the lookup actually matched, so a wrong pick is visible in the data
   * instead of only being findable by listening.
   */
  matchedAs?: {
    track: string
    artist: string
    album?: string
    score: number
  }
  /** Seconds into the preview where the clip window starts. */
  startAt: number
}

/** What happened on a single guess slot within a round. */
export type Attempt =
  | { kind: 'skipped' }
  | { kind: 'wrong'; songId: string }
  | { kind: 'correct'; songId: string }

export interface RoundState {
  song: Song
  /** 0-based index into STAGES. */
  stage: number
  attempts: Attempt[]
  status: 'playing' | 'won' | 'lost'
}

export type Mode = 'daily' | 'challenge'


/**
 * Apple's artwork URLs embed their own dimensions ("100x100bb.jpg"), so a
 * larger version is a string swap rather than a second request.
 */
export function artworkAt(url: string | undefined, size: number): string | null {
  if (!url) return null
  return url.replace(/\/\d+x\d+bb\./, `/${size}x${size}bb.`)
}
