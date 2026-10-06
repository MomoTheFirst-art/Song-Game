import { STAGES, STAGE_POINTS } from '../game/stages'
import { ar } from '../game/numerals'
import type { Attempt } from '../game/types'

interface Props {
  stage: number
  attempts: Attempt[]
}

/**
 * The ladder, and what each rung is worth.
 *
 * The points used to be hidden below 480px, which removed the entire reason to
 * guess early from the screen most people play on: the clip lengths were
 * visible but their price was not. They are the point of the ladder, so they
 * stay at every width and the current rung states its own stake outright.
 *
 * Spent rungs also used to be 0.55 opacity against 0.4 for untouched ones —
 * indistinguishable at a glance, so a player could not see what they had
 * already paid. Each state now looks like what it is.
 */
export function StageBar({ stage, attempts }: Props) {
  return (
    <ol className="stages" aria-label="مراحل المقطع ونقاطها">
      {STAGES.map((seconds, i) => {
        const attempt = attempts[i]
        const state = attempt
          ? attempt.kind === 'correct'
            ? 'correct'
            : attempt.kind === 'wrong'
              ? 'wrong'
              : 'skipped'
          : i === stage
            ? 'current'
            : 'locked'

        return (
          <li
            key={seconds}
            className={`stage stage-${state}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span className="stage-time">{ar(seconds)}ث</span>
            <span className="stage-points">{ar(STAGE_POINTS[i])}</span>
          </li>
        )
      })}
    </ol>
  )
}
