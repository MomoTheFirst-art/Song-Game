import { MAX_STAGE } from './stages.ts'
import type { Attempt, RoundState } from './types.ts'

/**
 * Record a guess or a request for more of the clip.
 *
 * The clip never runs past the mark the round has reached — it stops there and
 * waits — so asking for more is what spends a tier, whether that ask is a
 * wrong guess or the button. Running out of tiers is what loses the round.
 * Both game modes run this same rule.
 */
export function applyAttempt(round: RoundState, attempt: Attempt): RoundState {
  if (round.status !== 'playing') return round
  const attempts = [...round.attempts, attempt]

  if (attempt.kind === 'correct') {
    // solvedAs is what scoring reads, so it is recorded here rather than
    // inferred later from the attempt list.
    return { ...round, attempts, status: 'won', solvedAs: attempt.target }
  }
  if (round.stage >= MAX_STAGE) {
    return { ...round, attempts, status: 'lost' }
  }
  return { ...round, attempts, stage: round.stage + 1 }
}

/** Tiers the player still has, counting the one they are on. */
export const triesLeft = (round: RoundState): number => MAX_STAGE + 1 - round.stage
