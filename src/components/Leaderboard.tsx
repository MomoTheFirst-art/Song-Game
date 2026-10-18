import { useMemo } from 'react'
import { bestScore, loadRuns } from '../game/storage'
import { genreById } from '../game/catalogues'
import type { GenreId } from '../game/catalogues'
import { ar } from '../game/numerals'

interface Props {
  onClose: () => void
}

const MODE_LABEL: Record<string, string> = {
  daily: 'تحدي اليوم',
  challenge: 'تحدي عشوائي',
  pick: 'مبتدئ',
}

/**
 * The player's own runs, newest first.
 *
 * This was a shared scoreboard backed by Firestore. The backend is gone, so
 * there is nobody to compare against — and a page that silently showed one
 * device's scores under the heading "every player" would be lying. It says
 * what it is instead.
 */
export function Leaderboard({ onClose }: Props) {
  const runs = useMemo(() => loadRuns(), [])
  const best = useMemo(() => bestScore(), [])

  return (
    <section className="account">
      <h2>نتائجك</h2>

      {runs.length === 0 ? (
        <p className="complete-note">لم تُنهِ جولة بعد. العب واحدة وستظهر هنا.</p>
      ) : (
        <>
          <p className="complete-note">
            أفضل نتيجة: <strong>{ar(best)}</strong> — من {ar(runs.length)} جولة
          </p>
          <ol className="board">
            <li className="board-row board-head">
              <span className="board-name">الجولة</span>
              <span className="board-runs">المجموعة</span>
              <span className="board-score">النتيجة</span>
            </li>
            {runs.map((r, i) => (
              <li key={`${r.dateKey}-${i}`} className="board-row">
                <span className="board-name">{MODE_LABEL[r.mode] ?? r.mode}</span>
                <span className="board-runs">{genreById(r.genre as GenreId).label}</span>
                <span className="board-score">{ar(r.score)}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <p className="complete-note">محفوظة على هذا الجهاز وحده.</p>
      <button className="btn btn-next" onClick={onClose}>رجوع</button>
    </section>
  )
}
