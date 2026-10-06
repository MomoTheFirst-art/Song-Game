import { STAGES, STAGE_POINTS } from '../game/stages'
import { ar } from '../game/numerals'
import type { Attempt } from '../game/types'

interface Props {
  stage: number
  attempts: Attempt[]
  /** Sweeps a playhead across the current stage while the clip runs. */
  playing?: boolean
  loop?: boolean
}

/** Seconds this stage adds on top of the one before it. */
const span = (i: number): number => STAGES[i] - (STAGES[i - 1] ?? 0)

const LONGEST = STAGES[STAGES.length - 1]

function stateOf(attempt: Attempt | undefined, i: number, stage: number) {
  if (attempt) return attempt.kind === 'correct' ? 'correct' : attempt.kind
  return i === stage ? 'current' : 'locked'
}

/**
 * The clip as a timeline: fifteen seconds wide, broken where each stage ends.
 *
 * Widths are proportional to time rather than equal, so the one-second sliver
 * looks like what it is — the narrowest window and the one worth the most. The
 * colour cools from green to amber as the points fall, which is a different
 * axis from the spent/locked dimming, so a player can read what a stage is
 * worth and whether they still have it at the same glance.
 */
export function ClipBar({ stage, attempts, playing = false, loop = false }: Props) {
  const reached = STAGES[stage] ?? LONGEST

  return (
    <div className="clipbar">
      <div className="clipbar-track" aria-hidden="true">
        {STAGES.map((seconds, i) => (
          <span
            key={seconds}
            className={`seg seg-${stateOf(attempts[i], i, stage)}`}
            style={{ flexGrow: span(i) }}
          />
        ))}
        {playing && (
          <span
            className={loop ? 'clipbar-head clipbar-head-loop' : 'clipbar-head'}
            style={{
              // The head crosses exactly the window being played, in the time
              // it takes to play it.
              ['--to' as string]: `${(reached / LONGEST) * 100}%`,
              ['--dur' as string]: `${reached}s`,
            }}
          />
        )}
      </div>

      <ol className="clipbar-keys" aria-label="مراحل المقطع ونقاطها">
        {STAGES.map((seconds, i) => {
          const state = stateOf(attempts[i], i, stage)
          return (
            <li
              key={seconds}
              className={`key key-${state}`}
              style={{ flexGrow: span(i) }}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="key-time">{ar(seconds)}ث</span>
              <span className="key-points">{ar(STAGE_POINTS[i])}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
