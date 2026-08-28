import { STAGES, STAGE_POINTS } from '../game/stages'
import type { Attempt } from '../game/types'

interface Props {
  stage: number
  attempts: Attempt[]
}

export function StageBar({ stage, attempts }: Props) {
  return (
    <ol className="stages" aria-label="مراحل المقطع">
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
          <li key={seconds} className={`stage stage-${state}`}>
            <span className="stage-time">{seconds}s</span>
            <span className="stage-points">{STAGE_POINTS[i]}</span>
          </li>
        )
      })}
    </ol>
  )
}
