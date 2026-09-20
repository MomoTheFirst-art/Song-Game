import { STAGE_POINTS } from './stages.ts'
import type { RoundState } from './types.ts'

/**
 * Share of a stage's points for naming only the artist. Recognising a voice
 * is the easier half of the problem, so it pays the lesser half.
 */
export const ARTIST_SHARE = 0.5

/** Points for one finished round. A lost round scores nothing. */
export function roundScore(round: RoundState): number {
  if (round.status !== 'won') return 0
  const full = STAGE_POINTS[round.stage] ?? 0
  // Only مبتدئ sets solvedAs; everywhere else a win is a named song and
  // scores in full, which is what an absent value has to mean.
  return round.solvedAs === 'artist' ? Math.round(full * ARTIST_SHARE) : full
}

export function totalScore(rounds: RoundState[]): number {
  return rounds.reduce((sum, r) => sum + roundScore(r), 0)
}

/** The best score obtainable in a run of `n` rounds — all solved at stage 0. */
export function maxScore(n: number): number {
  return n * STAGE_POINTS[0]
}
