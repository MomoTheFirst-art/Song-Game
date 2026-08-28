import { STAGES } from '../game/stages'
import { roundScore } from '../game/scoring'
import type { RoundState } from '../game/types'

interface Props {
  round: RoundState
  onNext: () => void
  isLast: boolean
}

export function RoundResult({ round, onNext, isLast }: Props) {
  const won = round.status === 'won'
  const { song } = round

  return (
    <div className={won ? 'result result-won' : 'result result-lost'}>
      <p className="result-verdict">{won ? 'صحيح! 🎉' : 'انتهت المحاولات'}</p>

      <p className="result-song">
        <strong>{song.title}</strong>
        <span className="result-artist">
          {song.artist} · {song.year}
        </span>
      </p>

      {won && (
        <p className="result-score">
          +{roundScore(round)} نقطة — عند {STAGES[round.stage]} ثانية
        </p>
      )}

      <button className="btn btn-next" onClick={onNext}>
        {isLast ? 'النتيجة النهائية' : 'الأغنية التالية'}
      </button>
    </div>
  )
}
