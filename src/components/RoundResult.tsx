import { STAGES, secondsNoun } from '../game/stages'
import { roundScore } from '../game/scoring'
import { artworkAt } from '../game/types'
import type { RoundState } from '../game/types'

interface Props {
  round: RoundState
  onNext: () => void
  isLast: boolean
}

export function RoundResult({ round, onNext, isLast }: Props) {
  const won = round.status === 'won'
  const { song } = round
  const cover = artworkAt(song.artwork, 300)

  return (
    <div className={won ? 'result result-won' : 'result result-lost'}>
      <p className="result-verdict">
        {!won
          ? 'انتهت المحاولات'
          : round.solvedAs === 'artist'
            ? 'الفنان صحيح! 🎉'
            : 'صحيح! 🎉'}
      </p>

      <div className="reveal">
        {cover && (
          <img
            className="cover"
            src={cover}
            alt=""
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <p className="result-song">
          <strong>{song.title}</strong>
          <span className="result-artist">
            {song.artist} · {song.year}
          </span>
        </p>
      </div>

      {won && (
        <p className="result-score">
          +{roundScore(round)} نقطة — عند {STAGES[round.stage]} {secondsNoun(STAGES[round.stage])}
          {round.solvedAs === 'artist' && <span className="result-half"> (نصف النقاط)</span>}
        </p>
      )}

      <button className="btn btn-next" onClick={onNext}>
        {isLast ? 'النتيجة النهائية' : 'الأغنية التالية'}
      </button>
    </div>
  )
}
