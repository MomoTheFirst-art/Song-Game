import { useCallback, useState } from 'react'
import { PartySetup } from './components/PartySetup'
import { RoundPlay } from './components/RoundPlay'
import { Scoreboard } from './components/Scoreboard'
import { createPlayers, maxPlayersFor, playerScore, SONGS_PER_PLAYER } from './game/party'
import type { PartyPlayer } from './game/party'
import type { Song } from './game/types'

type Phase = 'setup' | 'handoff' | 'playing' | 'results'

interface Props {
  /** Songs that may be dealt — approved clips only. */
  pool: Song[]
  /** Everything guessable, so the answer does not stand out in suggestions. */
  catalogue: Song[]
  onHome: () => void
}

export function PartyGame({ pool, catalogue, onHome }: Props) {
  const [phase, setPhase] = useState<Phase>('setup')
  const [players, setPlayers] = useState<PartyPlayer[]>([])
  const [turn, setTurn] = useState(0)
  const [songIndex, setSongIndex] = useState(0)

  const start = useCallback(
    (names: string[]) => {
      setPlayers(createPlayers(names, pool))
      setTurn(0)
      setSongIndex(0)
      setPhase('handoff')
    },
    [pool],
  )

  const current = players[turn]

  /** Record the outcome, then move to the next song, player, or the results. */
  const finishSong = useCallback(
    (stage: number | null) => {
      setPlayers((prev) =>
        prev.map((p, i) => (i === turn ? { ...p, results: [...p.results, stage] } : p)),
      )

      if (songIndex + 1 < SONGS_PER_PLAYER) {
        setSongIndex((i) => i + 1)
        return
      }
      if (turn + 1 < players.length) {
        setTurn((t) => t + 1)
        setSongIndex(0)
        setPhase('handoff')
        return
      }
      setPhase('results')
    },
    [players.length, songIndex, turn],
  )

  if (phase === 'setup') {
    return (
      <main className="app">
        <PartySetup capacity={maxPlayersFor(pool)} onStart={start} onBack={onHome} />
      </main>
    )
  }

  if (phase === 'results') {
    return (
      <main className="app">
        <Scoreboard players={players} onAgain={() => setPhase('setup')} onHome={onHome} />
      </main>
    )
  }

  if (phase === 'handoff') {
    return (
      <main className="app">
        <section className="handoff">
          <p className="handoff-label">دور</p>
          <h2 className="handoff-name">{current.name}</h2>
          <p className="complete-note">
            مرّر الجهاز إلى {current.name} — {SONGS_PER_PLAYER} أغانٍ، ولا تنظروا إلى
            الشاشة معاً.
          </p>
          <button className="btn btn-next" onClick={() => setPhase('playing')}>
            جاهز
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="app">
      <header className="bar">
        <span className="score">{playerScore(current)} نقطة</span>
        <span className="count">
          {current.name} · أغنية {songIndex + 1} من {SONGS_PER_PLAYER}
        </span>
      </header>

      <RoundPlay
        key={`${current.id}-${songIndex}`}
        song={current.songs[songIndex]}
        catalogue={catalogue}
        onDone={finishSong}
        isLast={songIndex + 1 >= SONGS_PER_PLAYER && turn + 1 >= players.length}
      />
    </main>
  )
}
