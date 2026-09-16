import { STAGES, secondsNoun } from '../game/stages'
import type { ClipMode, ClipStatus } from '../hooks/useAudioClip'
import { SilentSwitchNotice } from './SilentSwitchNotice'

interface Props {
  stage: number
  status: ClipStatus
  mode: ClipMode
  onPlay: () => void
}

export function ClipPlayer({ stage, status, mode, onPlay }: Props) {
  const seconds = STAGES[stage]
  const busy = status === 'loading'
  const broken = status === 'missing' || status === 'error'

  return (
    <div className="player">
      <SilentSwitchNotice />
      <button className="btn btn-play" onClick={onPlay} disabled={busy || broken}>
        {status === 'playing' ? '⏸' : '▶'}
        <span className="play-label">
          {busy ? 'جارٍ التحميل…' : `تشغيل ${seconds} ${secondsNoun(seconds)}`}
        </span>
      </button>

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
