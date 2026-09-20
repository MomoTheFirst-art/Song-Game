import type { Mode } from '../game/types'

interface Props {
  mode: Mode
  score: number
  roundIndex: number
  roundCount: number
  onMode: (mode: Mode) => void
}

export function Header({ mode, score, roundIndex, roundCount, onMode }: Props) {
  return (
    <header className="header">
      <h1 className="logo">🎵 خمّن الأغنية</h1>

      <nav className="modes">
        <button
          className={mode === 'daily' ? 'tab tab-on' : 'tab'}
          onClick={() => onMode('daily')}
        >
          تحدي اليوم
        </button>
        <button
          className={mode === 'challenge' ? 'tab tab-on' : 'tab'}
          onClick={() => onMode('challenge')}
        >
          عشوائي
        </button>
        <button
          className={mode === 'pick' ? 'tab tab-on' : 'tab'}
          onClick={() => onMode('pick')}
        >
          مبتدئ
        </button>
      </nav>

      <div className="meta">
        <bdi className="meta-round" dir="ltr">
          {Math.min(roundIndex + 1, roundCount)} / {roundCount}
        </bdi>
        <span className="meta-score">{score} نقطة</span>
      </div>
    </header>
  )
}
