import { STAGES } from '../game/stages'
import { standings } from '../game/party'
import type { PartyPlayer } from '../game/party'

interface Props {
  players: PartyPlayer[]
  onAgain: () => void
  onHome: () => void
}

export function Scoreboard({ players, onAgain, onHome }: Props) {
  const rows = standings(players)
  const winners = rows.filter((r) => r.isWinner)

  return (
    <section className="complete">
      <h2>النتائج</h2>

      <p className="complete-score">
        {winners.length === 0 ? (
          <span className="board-nobody">لم يسجّل أحد نقاطاً</span>
        ) : winners.length === 1 ? (
          <>🏆 {winners[0].player.name}</>
        ) : (
          <>🏆 تعادل: {winners.map((w) => w.player.name).join(' و ')}</>
        )}
      </p>

      <ol className="board">
        {rows.map(({ player, score, solved, rank, isWinner }) => (
          <li key={player.id} className={isWinner ? 'board-row board-win' : 'board-row'}>
            <span className="board-rank">{rank}</span>
            <span className="board-name">{player.name}</span>
            <span className="board-solved">
              {solved} / {player.songs.length}
            </span>
            <span className="board-score">{score}</span>
          </li>
        ))}
      </ol>

      <details className="board-detail">
        <summary>ماذا سمع كل لاعب</summary>
        {players.map((p) => (
          <div key={p.id} className="board-songs">
            <strong>{p.name}</strong>
            <ul>
              {p.songs.map((song, i) => {
                const stage = p.results[i]
                return (
                  <li key={song.id} className={stage === null ? 'recap-lost' : 'recap-won'}>
                    <span className="recap-mark">{stage === null ? '✗' : '✓'}</span>
                    <span className="recap-title">{song.title}</span>
                    <span className="recap-artist">{song.artist}</span>
                    <span className="recap-stage">
                      {stage === null ? '—' : `${STAGES[stage]}s`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </details>

      <div className="complete-actions">
        <button className="btn btn-next" onClick={onAgain}>
          جولة جديدة
        </button>
        <button className="btn" onClick={onHome}>
          القائمة الرئيسية
        </button>
      </div>
    </section>
  )
}
