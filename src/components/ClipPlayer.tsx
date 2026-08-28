import { STAGES } from '../game/stages'
import type { ClipStatus } from '../hooks/useAudioClip'

interface Props {
  stage: number
  status: ClipStatus
  onPlay: () => void
}

export function ClipPlayer({ stage, status, onPlay }: Props) {
  const seconds = STAGES[stage]
  const busy = status === 'loading'
  const broken = status === 'missing' || status === 'error'

  return (
    <div className="player">
      <button className="btn btn-play" onClick={onPlay} disabled={busy || broken}>
        {status === 'playing' ? '⏸' : '▶'}
        <span className="play-label">
          {busy ? 'جارٍ التحميل…' : `تشغيل ${seconds} ثانية`}
        </span>
      </button>

      {status === 'missing' && (
        <p className="notice notice-warn">
          ملف الصوت غير موجود. ضع الملف في <code>public/clips/</code> ثم أعد المحاولة.
        </p>
      )}
      {status === 'error' && (
        <p className="notice notice-warn">تعذّر تشغيل الملف الصوتي.</p>
      )}
    </div>
  )
}
