import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountPanel } from './components/AccountPanel'
import { AuthGate } from './components/AuthGate'
import { Admin } from './components/Admin'
import { AudioCheck } from './components/AudioCheck'
import { Home } from './components/Home'
import { Leaderboard } from './components/Leaderboard'
import { PartyGame } from './PartyGame'
import { maxPlayersFor } from './game/party'

import { ClipPlayer } from './components/ClipPlayer'
import { DayComplete } from './components/DayComplete'
import { GuessInput } from './components/GuessInput'
import { Header } from './components/Header'
import { RoundResult } from './components/RoundResult'
import { ClipBar } from './components/ClipBar'
import { WrongGuesses } from './components/WrongGuesses'
import { challengeSongs, dailySongs, todayKey } from './game/daily'
import { roundScore, totalScore } from './game/scoring'
import { MAX_STAGE, STAGES } from './game/stages'
import { applyAttempt, triesLeft } from './game/round'
import {
  loadDaily, recentlyPlayed, rememberPlayed, saveRun as saveLocalRun,
} from './game/storage'
import { loadDecisions, playableSongs, verdictFor } from './game/review'
import { GENRES, everySong, genreById, loadGenre, saveGenre } from './game/catalogues'
import type { Genre, GenreId } from './game/catalogues'
import { loadStarts, withStarts } from './game/starts'
import { DIFFICULTY_LABEL } from './game/types'
import { normalize } from './game/search'
import type { Mode, RoundState, Song } from './game/types'
import { useAudioClip } from './hooks/useAudioClip'
import { useLoopPreference } from './hooks/useLoopPreference'
import { usePlayer, type Player } from './hooks/usePlayer'
import { recordRun } from './firebase/scores'


/**
 * What a genre can actually be played with: a clip, not one a reviewer
 * rejected, and the start point the reviewer chose.
 *
 * Built per genre rather than once at module load, because the player switches
 * between them without reloading.
 */
function buildCatalogue(genre: Genre) {
  const decisions = loadDecisions()
  const catalogue = withStarts(playableSongs(genre.all, decisions), loadStarts())
  // A party deals only approved clips — a wrong one costs a player their turn,
  // not just a round. Guessing still searches the whole playable catalogue so
  // the answer does not stand out among the suggestions.
  const partyPool = catalogue.filter((s) => verdictFor(s, decisions) === 'approved')
  return { catalogue, partyPool }
}

function newRound(song: Song): RoundState {
  return { song, stage: 0, attempts: [], status: 'playing' }
}

function Game({
  onHome,
  player,
  startMode = 'daily',
  catalogue,
  genre,
}: {
  onHome: () => void
  player: Player | null
  startMode?: Mode
  catalogue: Song[]
  genre: Genre
}) {
  const dateKey = useMemo(() => todayKey(), [])
  const [mode, setMode] = useState<Mode>(startMode)
  // Both of these are seeded from the same draw rather than calling it twice:
  // a challenge draw is random, so a second call would deal a different five
  // and the first round would not be the lineup's first song.
  const [lineup, setLineup] = useState<Song[]>(() =>
    startMode === 'daily'
      ? dailySongs(catalogue, dateKey)
      : challengeSongs(catalogue, recentlyPlayed()),
  )
  const [roundIndex, setRoundIndex] = useState(0)
  const [round, setRound] = useState<RoundState>(() => newRound(lineup[0]))
  const [finished, setFinished] = useState<RoundState[]>([])
  const [phase, setPhase] = useState<'playing' | 'roundOver' | 'done'>('playing')

  const clipUrl = round.song.previewUrl as string
  const { status, mode: clipMode, play, stop } = useAudioClip(clipUrl)
  const [loop, setLoop] = useLoopPreference()

  // A daily run is one per UTC day — returning players see their result, not a
  // replay. Challenge runs are unlimited, so this must not catch them.
  useEffect(() => {
    if (mode !== 'daily') return
    if (loadDaily(dateKey)) setPhase('done')
  }, [mode, dateKey])

  const startRun = useCallback(
    (nextMode: Mode) => {
      stop()
      const songs =
        nextMode === 'daily'
          ? dailySongs(catalogue, dateKey)
          : challengeSongs(catalogue, recentlyPlayed())
      setMode(nextMode)
      setLineup(songs)
      setRoundIndex(0)
      setRound(newRound(songs[0]))
      setFinished([])
      setPhase(nextMode === 'daily' && loadDaily(dateKey) ? 'done' : 'playing')
    },
    [dateKey, stop],
  )


  const advance = useCallback(
    (attempt: RoundState['attempts'][number]) => {
      stop()
      setRound((r) => {
        const next = applyAttempt(r, attempt)
        if (next.status !== 'playing') setPhase('roundOver')
        return next
      })
    },
    [stop],
  )

  const onGuess = useCallback(
    (song: Song) => {
      if (phase !== 'playing') return
      advance(
        song.id === round.song.id
          ? { kind: 'correct', target: 'song' }
          : { kind: 'wrong', target: 'song', label: song.title },
      )
    },
    [advance, phase, round.song.id],
  )

  const onGuessArtist = useCallback(
    (artist: string) => {
      if (phase !== 'playing') return
      // Compared on the normalized form: the catalogue spells the same
      // performer several ways (أصالة / اصاله), and the player picked from a
      // list built by folding exactly those variants together.
      const right = normalize(artist) === normalize(round.song.artist)
      advance(
        right
          ? { kind: 'correct', target: 'artist' }
          : { kind: 'wrong', target: 'artist', label: artist },
      )
    },
    [advance, phase, round.song.artist],
  )

  const onSkip = useCallback(() => {
    if (phase !== 'playing') return
    advance({ kind: 'skipped' })
  }, [advance, phase])

  const onNext = useCallback(() => {
    const done = [...finished, round]
    setFinished(done)

    if (roundIndex + 1 >= lineup.length) {
      const score = totalScore(done)
      const stages = done.map((r) => (r.status === 'won' ? r.stage : null))
      rememberPlayed(lineup.map((s) => s.id))
      saveLocalRun(mode, { dateKey, score, stages })

      // Signed in? Keep a copy in Firestore too. Deliberately fire-and-forget:
      // the run is already saved locally, and a network failure must not block
      // the player from seeing the result they just earned.
      // Only a Firebase-backed player reaches the shared board; a device-local
      // one already has the run in localStorage.
      if (player?.remote) {
        void recordRun(player.id, player.name, score).catch(() => {})
      }
      setPhase('done')
      return
    }

    setRoundIndex((i) => i + 1)
    setRound(newRound(lineup[roundIndex + 1]))
    setPhase('playing')
  }, [dateKey, finished, lineup, mode, round, roundIndex, player])

  const runningScore = totalScore(finished) + (phase === 'roundOver' ? roundScore(round) : 0)

  if (phase === 'done') {
    const rounds = finished.length > 0 ? finished : []
    return (
      <main className="app">
        <Header
          mode={mode}
          score={totalScore(rounds)}
          roundIndex={lineup.length}
          roundCount={lineup.length}
          onMode={startRun}
        />
        {rounds.length > 0 ? (
          <DayComplete
            rounds={rounds}
            score={totalScore(rounds)}
            dateKey={dateKey}
            mode={mode}
            onReplay={() => startRun('challenge')}
          />
        ) : (
          <section className="complete">
            <h2>لعبت تحدي اليوم بالفعل</h2>
            <p className="complete-note">عُد غداً لتحدٍ جديد، أو جرّب جولة عشوائية.</p>
            <button className="btn btn-next" onClick={() => startRun('challenge')}>
              جولة عشوائية
            </button>
          </section>
        )}
      </main>
    )
  }

  return (
    <main className="app app-playing">
      <Header
        mode={mode}
        score={runningScore}
        roundIndex={roundIndex}
        roundCount={lineup.length}
        onMode={startRun}
      />

      <p className="difficulty">
        المستوى: {DIFFICULTY_LABEL[round.song.difficulty]}
        <button className="linkish" onClick={onHome}>القائمة</button>
      </p>

      <ClipBar stage={round.stage} playing={status === 'playing'} loop={loop} />

      <ClipPlayer
        stage={round.stage}
        status={status}
        mode={clipMode}
        loop={loop}
        onLoopChange={setLoop}
        onPlay={() => play(round.song.startAt, STAGES[round.stage], loop)}
        onStop={stop}
      />

      <WrongGuesses attempts={round.attempts} />

      {phase === 'playing' ? (
        <GuessInput
          catalogue={catalogue}
          dir={genre.dir}
          disabled={false}
          onGuess={onGuess}
          onGuessArtist={mode === 'pick' ? onGuessArtist : undefined}
          onSkip={onSkip}
          skipLabel={round.stage >= MAX_STAGE ? 'استسلمت' : 'اسمع أكثر'}
          left={triesLeft(round)}
        />
      ) : (
        <RoundResult round={round} onNext={onNext} isLast={roundIndex + 1 >= lineup.length} />
      )}
    </main>
  )
}



type Screen = 'home' | 'solo' | 'challenge' | 'pick' | 'party' | 'account' | 'board'

export default function App() {
  // #admin opens the clip review console: every clip, what it matched, and a
  // verdict. Kept off the player-facing UI, reachable by link.
  const [hash, setHash] = useState(() => window.location.hash)
  const [screen, setScreen] = useState<Screen>('home')
  const [genreId, setGenreId] = useState<GenreId>(loadGenre)
  const genre = genreById(genreId)
  const { catalogue, partyPool } = useMemo(() => buildCatalogue(genre), [genre])
  const { player, ready: playerReady, join, rename, leave } = usePlayer()

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Left outside the gate on purpose: it is the owner's review console,
  // already reachable only by knowing the URL, and gating it would mean a
  // broken auth provider locks the catalogue out of review too.
  if (hash === '#admin' || hash === '#review') return <Admin songs={everySong} />
  // #audio reports what the audio stack does on the device in hand — the only
  // way to diagnose an iOS failure from a machine that has no iOS.
  if (hash === '#audio') return <AudioCheck songs={catalogue} />

  return (
    <AuthGate
      player={player}
      ready={playerReady}
      onJoin={join}
      onRename={rename}
      onLeave={leave}
    >
      {renderScreen()}
    </AuthGate>
  )

  function renderScreen() {
  const game = { onHome: () => setScreen('home'), player, catalogue, genre }
  if (screen === 'solo') return <Game {...game} />
  if (screen === 'challenge') return <Game {...game} startMode="challenge" />
  if (screen === 'pick') return <Game {...game} startMode="pick" />
  if (screen === 'account') {
    return (
      <main className="app">
        <AccountPanel
          player={player}
          onJoin={join}
          onRename={rename}
          onLeave={leave}
          onClose={() => setScreen('home')}
        />
      </main>
    )
  }
  if (screen === 'board') {
    return (
      <main className="app">
        <Leaderboard meUid={player?.id ?? null} onClose={() => setScreen('home')} />
      </main>
    )
  }
  if (screen === 'party') {
    return (
      <PartyGame
        pool={partyPool}
        catalogue={catalogue}
        onHome={() => setScreen('home')}
      />
    )
  }

  return (
    <Home
      genres={GENRES}
      genreId={genreId}
      onGenre={(id: GenreId) => {
        setGenreId(id)
        saveGenre(id)
      }}
      playableCount={catalogue.length}
      genreTotal={genre.all.length}
      partyCapacity={maxPlayersFor(partyPool)}
      onSolo={() => setScreen('solo')}
      onChallenge={() => setScreen('challenge')}
      onPick={() => setScreen('pick')}
      playerName={player?.name ?? null}
      onAccount={() => setScreen('account')}
      onBoard={() => setScreen('board')}
      onParty={() => setScreen('party')}
    />
  )
  }
}
