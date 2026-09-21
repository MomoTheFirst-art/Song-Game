import { useEffect, useState } from 'react'
import { getLeaderboard, type LeaderboardRow } from '../firebase/scores'

interface Props {
  meUid: string | null
  onClose: () => void
}

/**
 * Every player's best score, highest first.
 *
 * Reads the profile documents directly rather than aggregating run history:
 * that would need a collection-group query and the right to read everyone's
 * rounds, which is far more access than a scoreboard warrants. A profile holds
 * only a chosen name and two numbers, so this page can show them all without
 * exposing anything a player did not put there.
 */
export function Leaderboard({ meUid, onClose }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    getLeaderboard(50).then(
      (r) => live && setRows(r),
      (err) => {
        if (!live) return
        // A rules rejection and a missing database look identical to a player,
        // so say what a player can act on and keep the detail in the console.
        console.warn('Leaderboard read failed', err)
        setError('تعذّر تحميل النتائج الآن.')
      },
    )
    return () => {
      live = false
    }
  }, [])

  const mine = rows?.findIndex((r) => r.uid === meUid) ?? -1

  return (
    <section className="account">
      <h2>نتائج اللاعبين</h2>

      {error && <p className="notice notice-warn">{error}</p>}
      {!error && rows === null && <p className="complete-note">جارٍ التحميل…</p>}

      {rows !== null && rows.length === 0 && (
        <p className="complete-note">لا نتائج بعد — كن أول من يسجّل.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          {mine >= 0 && (
            <p className="complete-note">
              ترتيبك {mine + 1} من {rows.length}
            </p>
          )}
          <ol className="board">
            <li className="board-row board-head">
              <span className="board-rank">#</span>
              <span className="board-name">اللاعب</span>
              <span className="board-runs">جولات</span>
              <span className="board-score">أفضل نتيجة</span>
            </li>
            {rows.map((row, i) => (
              <li
                key={row.uid}
                className={row.uid === meUid ? 'board-row board-me' : 'board-row'}
              >
                <span className="board-rank">{i + 1}</span>
                <span className="board-name">{row.displayName}</span>
                <span className="board-runs">{row.runs}</span>
                <span className="board-score">{row.bestScore}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      <button className="btn btn-next" onClick={onClose}>رجوع</button>
    </section>
  )
}
