/**
 * Where the clip's value steps down, in seconds. The clip plays straight
 * through from 0 to 15; crossing each of these marks drops the round to the
 * next tier. Every value must fit inside a 30-second preview.
 */
export const STAGES = [1, 3, 5, 10, 15] as const

/** Points awarded for a correct answer at each stage. */
export const STAGE_POINTS = [1200, 975, 750, 525, 300] as const

/** The whole clip, which is what one press now plays. */
export const CLIP_SECONDS = STAGES[STAGES.length - 1]

export const MAX_STAGE = STAGES.length - 1

/**
 * Wrong guesses allowed before the round is lost.
 *
 * Listening is what costs points now, so a guess no longer moves the tier —
 * without a cap, the autocomplete could simply be walked until it hit.
 */
export const MAX_ATTEMPTS = 5

/**
 * The tier a player has fallen to after hearing `seconds` of the clip.
 *
 * Crossing a mark spends that tier: at the instant the first second is up the
 * 1200 is gone, and 975 is what a correct answer is now worth. The last tier
 * has nothing below it, so the clip running out does not drop the player past
 * the floor.
 */
export function tierAfter(seconds: number): number {
  let tier = 0
  for (let i = 0; i < STAGES.length; i++) {
    if (seconds >= STAGES[i]) tier = Math.min(i + 1, MAX_STAGE)
  }
  return tier
}

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

