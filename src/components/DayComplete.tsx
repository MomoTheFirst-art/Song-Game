import { useState } from 'react'
import { STAGES } from '../game/stages'
import { maxScore } from '../game/scoring'
import { shareText } from '../game/share'
import { artworkAt } from '../game/types'
import type { Mode, RoundState } from '../game/types'

interface Props {
  rounds: RoundState[]
  score: number
  dateKey: string
  mode: Mode
  onPractice: () => void
}

export function DayComplete({ rounds, score, dateKey, mode, onPractice }: Props) {
  const [copied, setCopied] = useState(false)
  const solved = rounds.filter((r) => r.status === 'won').length
  const stages = rounds.map((r) => (r.status === 'won' ? r.stage : null))

  async function share() {
    const text = shareText(dateKey, score, stages)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (insecure origin, denied permission) — leave the
      // button as-is rather than claiming a copy that did not happen.
    }
  }

  return (
    <section className="complete">
      <h2>{mode === 'daily' ? 'انتهى تحدي اليوم' : 'انتهت الجولة'}</h2>

      <p className="complete-score">
        <strong>{score}</strong>
        <span> / {maxScore(rounds.length)}</span>
      </p>
      <p className="complete-solved">
        عرفت {solved} من {rounds.length}
      </p>

      <ul className="recap">
        {rounds.map((r) => (
          <li key={r.song.id} className={r.status === 'won' ? 'recap-won' : 'recap-lost'}>
            <span className="recap-mark">{r.status === 'won' ? '✓' : '✗'}</span>
            {artworkAt(r.song.artwork, 100) && (
              <img
                className="recap-cover"
                src={artworkAt(r.song.artwork, 100) as string}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden' }}
              />
            )}
            <span className="recap-title">{r.song.title}</span>
            <span className="recap-artist">{r.song.artist}</span>
            <span className="recap-stage">
              {r.status === 'won' ? `${STAGES[r.stage]}s` : '—'}
            </span>
          </li>
        ))}
      </ul>

      <div className="complete-actions">
        {mode === 'daily' && (
          <button className="btn btn-share" onClick={share}>
            {copied ? 'تم النسخ ✓' : 'شارك النتيجة'}
          </button>
        )}
        <button className="btn btn-next" onClick={onPractice}>
          جولة تدريب
        </button>
      </div>

      {mode === 'daily' && <p className="complete-note">تحدٍ جديد كل يوم بتوقيت UTC.</p>}
    </section>
  )
}
