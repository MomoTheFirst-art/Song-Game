/**
 * How far the clip plays at each tier, in seconds. One press plays from the
 * start to the current mark and stops there; asking for more moves to the next.
 * Every value must fit inside a 30-second preview.
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

