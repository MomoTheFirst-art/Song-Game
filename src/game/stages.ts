/**
 * Clip lengths in seconds. A wrong guess or a skip unlocks the next one, so
 * the puzzle gets easier the longer a player takes. Every value must fit
 * inside a 30-second preview.
 */
export const STAGES = [1, 3, 5, 10, 15] as const

/** Points awarded for a correct answer at each stage. */
export const STAGE_POINTS = [1200, 975, 750, 525, 300] as const

export const MAX_STAGE = STAGES.length - 1

/**
 * Arabic counts the noun by the number: one takes the singular, two its own
 * dual form, three to ten the plural, and eleven upwards the singular again.
 */
export function secondsNoun(n: number): string {
  if (n === 1) return 'ثانية'
  if (n === 2) return 'ثانيتان'
  if (n >= 3 && n <= 10) return 'ثوانٍ'
  return 'ثانية'
}

/** e.g. "٣ ثوانٍ" — the number with its correctly inflected noun. */
export function stageLabel(stage: number): string {
  const s = STAGES[stage]
  return `${s} ${secondsNoun(s)}`
}
