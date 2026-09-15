import { STAGE_POINTS } from './stages.ts'
import type { RoundState } from './types.ts'

/** Points for one finished round. A lost round scores nothing. */
export function roundScore(round: RoundState): number {
  if (round.status !== 'won') return 0
  return STAGE_POINTS[round.stage] ?? 0
}

export function totalScore(rounds: RoundState[]): number {
  return rounds.reduce((sum, r) => sum + roundScore(r), 0)
}

/** The best score obtainable in a run of `n` rounds — all solved at stage 0. */
export function maxScore(n: number): number {
  return n * STAGE_POINTS[0]
}
