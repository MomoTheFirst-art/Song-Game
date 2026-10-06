import { CLIP_SECONDS, STAGES, STAGE_POINTS } from '../game/stages'
import { ar } from '../game/numerals'

interface Props {
  /** The tier the clock has brought the round down to. */
  stage: number
  /** Sweeps the playhead across the whole clip while it runs. */
  playing?: boolean
  loop?: boolean
}

/** Seconds this tier adds on top of the one before it. */
const span = (i: number): number => STAGES[i] - (STAGES[i - 1] ?? 0)

/**
 * The clip as a timeline: fifteen seconds wide, marked where its value steps
 * down.
 *
 * Widths are proportional to time rather than equal, so the one-second window
 * looks like what it is — the narrowest slice and the one worth the most. The
 * colour cools from green to coral as the points fall, which is a different
 * axis from the spent/ahead dimming, so a player can read what a stretch is
 * worth and whether it has already gone by at the same glance.
 */
export function ClipBar({ stage, playing = false, loop = false }: Props) {
  return (
    <div className="clipbar">
      <div className="clipbar-track" aria-hidden="true">
        {STAGES.map((seconds, i) => (
          <span
            key={seconds}
            className={`seg seg-${i < stage ? 'spent' : i === stage ? 'current' : 'ahead'}`}
            style={{ flexGrow: span(i) }}
          />
        ))}
        {playing && (
          // One press, one sweep: the head crosses the whole clip in the time
          // the clip takes, rather than restarting per tier.
          <span
            className={loop ? 'clipbar-head clipbar-head-loop' : 'clipbar-head'}
            style={{ ['--dur' as string]: `${CLIP_SECONDS}s` }}
          />
        )}
      </div>

      <ol className="clipbar-keys" aria-label="قيمة المقطع بمرور الوقت">
        {STAGES.map((seconds, i) => {
          const state = i < stage ? 'spent' : i === stage ? 'current' : 'ahead'
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
