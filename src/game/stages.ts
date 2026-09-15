/**
 * Clip lengths in seconds. A wrong guess or a skip unlocks the next one,
 * so the puzzle gets easier the longer a player takes.
 */
export const STAGES = [0.1, 0.5, 2, 8, 15] as const

/** Points awarded for a correct answer at each stage. */
export const STAGE_POINTS = [1200, 975, 750, 525, 300] as const

export const MAX_STAGE = STAGES.length - 1

export function stageLabel(stage: number): string {
  const s = STAGES[stage]
  return s < 1 ? `${s} ثانية` : `${s} ثوانٍ`
}
