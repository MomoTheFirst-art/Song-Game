import { STAGES, secondsNoun } from '../game/stages'
import type { ClipMode, ClipStatus } from '../hooks/useAudioClip'
import { SilentSwitchNotice } from './SilentSwitchNotice'

interface Props {
  stage: number
  status: ClipStatus
  mode: ClipMode
  loop: boolean
  onLoopChange: (loop: boolean) => void
  onPlay: () => void
  onStop: () => void
}

export function ClipPlayer({ stage, status, mode, loop, onLoopChange, onPlay, onStop }: Props) {
  const seconds = STAGES[stage]
  const busy = status === 'loading'
  const broken = status === 'missing' || status === 'error'
  const playing = status === 'playing'

  return (
    <div className="player">
      <SilentSwitchNotice />

      {/* While playing this stops rather than restarts. With the loop on there
          is otherwise no way out of it, and the ⏸ glyph was already promising
          a stop the button did not deliver. */}
      <button
        className="btn btn-play"
        onClick={playing ? onStop : onPlay}
        disabled={busy || broken}
      >
        {playing ? '⏸' : '▶'}
        <span className="play-label">
          {busy
            ? 'جارٍ التحميل…'
            : playing
              ? 'إيقاف'
              : `تشغيل ${seconds} ${secondsNoun(seconds)}`}
        </span>
      </button>

      <label className="loop-toggle">
        <input
          type="checkbox"
          checked={loop}
          onChange={(e) => {
            onLoopChange(e.target.checked)
            // Turning it off mid-loop has to stop the audio: a looping clip
            // never ends by itself, so the setting alone would leave it
            // running until the round changed.
            if (!e.target.checked && playing) onStop()
          }}
          disabled={broken}
        />
        <span>تكرار المقطع</span>
      </label>

      {status === 'missing' && (
        <p className="notice notice-warn">
          رابط المقطع لم يعد صالحاً. أعد تشغيل <code>npm run previews</code> لتحديثه.
        </p>
      )}
      {status === 'error' && (
        <p className="notice notice-warn">تعذّر تشغيل الملف الصوتي.</p>
      )}
      {mode === 'element' && !broken && (
        <p className="notice notice-soft">
          يُشغَّل المقطع مباشرة من المصدر — التوقيت تقريبي في المراحل القصيرة.
        </p>
      )}
    </div>
  )
}
