import { useEffect, useState } from 'react'
import { getLeaderboard, type LeaderboardRow } from '../firebase/scores'

interface Props {
  meUid: string | null
  onClose: () => void
}

export function Leaderboard({ meUid, onClose }: Props) {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    getLeaderboard().then(
      (r) => live && setRows(r),
      () => live && setError(true),
    )
    return () => {
      live = false
    }
  }, [])

  return (
    <section className="account">
      <h2>لوحة الصدارة</h2>

      {error && <p className="notice notice-warn">تعذّر تحميل اللوحة.</p>}
      {!error && rows === null && <p className="complete-note">جارٍ التحميل…</p>}
      {rows !== null && rows.length === 0 && (
        <p className="complete-note">لا نتائج بعد — كن أول من يسجّل.</p>
      )}

      {rows !== null && rows.length > 0 && (
        <ol className="board">
          {rows.map((row, i) => (
            <li key={row.uid} className={row.uid === meUid ? 'board-row board-me' : 'board-row'}>
              <span className="board-rank">{i + 1}</span>
              <span className="board-name">{row.displayName}</span>
              <span className="board-score">{row.bestScore}</span>
            </li>
          ))}
        </ol>
      )}

      <button className="btn btn-next" onClick={onClose}>رجوع</button>
    </section>
  )
}
