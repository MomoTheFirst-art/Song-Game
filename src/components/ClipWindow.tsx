import { useRef } from 'react'
import { MAX_START, PREVIEW_SECONDS, clampStart } from '../game/starts'
import { STAGES } from '../game/stages'

interface Props {
  start: number
  onStart: (seconds: number) => void
}

/** The hardest stage. Where this lands is what the start point really decides. */
const FIRST = STAGES[0]
const WINDOW = STAGES[STAGES.length - 1]

const pct = (seconds: number): string => `${(seconds / PREVIEW_SECONDS) * 100}%`

/**
 * The whole 30-second preview, with the stretch players actually hear drawn on
 * it and draggable.
 *
 * A bare slider gave a number but no picture: it could not show that the window
 * is half the preview, that it runs out of room at 15 seconds, or where inside
 * it the one-second stage falls — which is the only part most players ever get.
 */
export function ClipWindow({ start, onStart }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const grabOffset = useRef<number | null>(null)

  const secondsAt = (clientX: number): number => {
    const box = trackRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return start
    return ((clientX - box.left) / box.width) * PREVIEW_SECONDS
  }

  const nudge = (by: number) => onStart(clampStart(start + by))

  return (
    <div className="cwin">
      <div className="cwin-track" ref={trackRef}>
        <div
          className="cwin-sel"
          style={{ insetInlineStart: pct(start), width: pct(WINDOW) }}
          role="slider"
          tabIndex={0}
          aria-label="بداية المقطع المسموع"
          aria-valuemin={0}
          aria-valuemax={MAX_START}
          aria-valuenow={start}
          aria-valuetext={`من ${start} إلى ${start + WINDOW} ثانية`}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            grabOffset.current = secondsAt(e.clientX) - start
          }}
          onPointerMove={(e) => {
            if (grabOffset.current === null) return
            onStart(clampStart(secondsAt(e.clientX) - grabOffset.current))
          }}
          onPointerUp={(e) => {
            grabOffset.current = null
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          onPointerCancel={() => {
            grabOffset.current = null
          }}
          onKeyDown={(e) => {
            // Shift for whole seconds, otherwise the half-second the value snaps to.
            const step = e.shiftKey ? 1 : 0.5
            if (e.key === 'ArrowLeft') nudge(-step)
            else if (e.key === 'ArrowRight') nudge(step)
            else if (e.key === 'Home') onStart(0)
            else if (e.key === 'End') onStart(MAX_START)
            else return
            e.preventDefault()
          }}
        >
          {/* Everyone hears this second; most hear nothing else. */}
          <span className="cwin-first" style={{ width: `${(FIRST / WINDOW) * 100}%` }} />
        </div>
      </div>

      <p className="cwin-read">
        <span>{start}s</span>
        <span className="cwin-dim">ما يسمعه اللاعب</span>
        <span>{start + WINDOW}s</span>
      </p>
    </div>
  )
}
