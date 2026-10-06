import { MAX_ATTEMPTS, tierAfter } from './stages.ts'
import type { Attempt, RoundState } from './types.ts'

/**
 * Record a guess or a surrender.
 *
 * A guess no longer moves the tier — the clock does that — so the attempt
 * count is what ends a round that is going nowhere, and giving up ends it
 * outright. Both game modes run this same rule.
 */
export function applyAttempt(round: RoundState, attempt: Attempt): RoundState {
  if (round.status !== 'playing') return round
  const attempts = [...round.attempts, attempt]

  if (attempt.kind === 'correct') {
    // solvedAs is what scoring reads, so it is recorded here rather than
    // inferred later from the attempt list.
    return { ...round, attempts, status: 'won', solvedAs: attempt.target }
  }
  if (attempt.kind === 'skipped' || attempts.length >= MAX_ATTEMPTS) {
    return { ...round, attempts, status: 'lost' }
  }
  return { ...round, attempts }
}

/**
 * Charge the round for `seconds` of the clip having played.
 *
 * Only ever downwards: replaying cannot buy a tier back, because the player
 * has already heard that much of the song.
 */
export function applyListened(round: RoundState, seconds: number): RoundState {
  if (round.status !== 'playing') return round
  const stage = Math.max(round.stage, tierAfter(seconds))
  return stage === round.stage ? round : { ...round, stage }
}
