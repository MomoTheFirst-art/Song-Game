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
  /** Path under /public, e.g. "/clips/song.mp3" */
  clip: string
  /**
   * Remote 30-second preview, filled in by scripts/fetch-previews.mjs.
   * Takes precedence over `clip` when present.
   */
  previewUrl?: string
  /** Cover art URL, recorded alongside a preview. */
  artwork?: string
  /** Seconds into the file where the clip window starts. */
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

export type Mode = 'daily' | 'practice'
