import { useCallback, useEffect, useMemo, useState } from 'react'
import { AccountPanel } from './components/AccountPanel'
import { Admin } from './components/Admin'
import { AudioCheck } from './components/AudioCheck'
import { Home } from './components/Home'
import { Leaderboard } from './components/Leaderboard'
import { PartyGame } from './PartyGame'
import { maxPlayersFor } from './game/party'
import catalogueData from './data/songs.json'
import { ClipPlayer } from './components/ClipPlayer'
import { DayComplete } from './components/DayComplete'
import { GuessInput } from './components/GuessInput'
import { Header } from './components/Header'
import { RoundResult } from './components/RoundResult'
import { StageBar } from './components/StageBar'
import { challengeSongs, dailySongs, todayKey } from './game/daily'
import { roundScore, totalScore } from './game/scoring'
import { MAX_STAGE, STAGES } from './game/stages'
import {
  loadDaily, recentlyPlayed, rememberPlayed, saveRun as saveLocalRun,
} from './game/storage'
import { loadDecisions, playableSongs } from './game/review'
import { DIFFICULTY_LABEL } from './game/types'
import { normalize } from './game/search'
import type { Mode, RoundState, Song } from './game/types'
import { useAudioClip } from './hooks/useAudioClip'
import { useLoopPreference } from './hooks/useLoopPreference'
import { useAuth } from './hooks/useAuth'
import { recordRun, saveRun } from './firebase/scores'

const allSongs = catalogueData as Song[]
/**
 * What the game may play: a clip, and not one a reviewer rejected. Once every
 * tier has an approved song, approvals alone decide.
 */
const catalogue = playableSongs(allSongs, loadDecisions())
/**
 * A party deals only approved clips — a wrong one costs a player their turn,
 * not just a round. Guessing still searches the whole playable catalogue so
 * the answer does not stand out among the suggestions.
 */
const partyPool = catalogue.filter((s) => s.approved === true)

function newRound(song: Song): RoundState {
  return { song, stage: 0, attempts: [], status: 'playing' }
}

function Game({ onHome, startMode = 'daily' }: { onHome: () => void; startMode?: Mode }) {
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
  const { user } = useAuth()

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
        const attempts = [...r.attempts, attempt]
        if (attempt.kind === 'correct') {
          setPhase('roundOver')
          // solvedAs is what scoring reads, so it is recorded here rather than
          // inferred later from the attempt list.
          return { ...r, attempts, status: 'won', solvedAs: attempt.target }
        }
        if (r.stage >= MAX_STAGE) {
          setPhase('roundOver')
          return { ...r, attempts, status: 'lost' }
        }
        return { ...r, attempts, stage: r.stage + 1 }
      })
    },
    [stop],
  )

  const onGuess = useCallback(
    (song: Song) => {
      if (phase !== 'playing') return
      advance(
        song.id === round.song.id
          ? { kind: 'correct', target: 'song', value: song.id }
          : { kind: 'wrong', target: 'song', value: song.id },
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
          ? { kind: 'correct', target: 'artist', value: artist }
          : { kind: 'wrong', target: 'artist', value: artist },
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
      if (user) {
        const name = user.displayName || 'لاعب'
        void saveRun(user.uid, { mode, dateKey, score, stages }).catch(() => {})
        void recordRun(user.uid, name, score).catch(() => {})
      }
      setPhase('done')
      return
    }

    setRoundIndex((i) => i + 1)
    setRound(newRound(lineup[roundIndex + 1]))
    setPhase('playing')
  }, [dateKey, finished, lineup, mode, round, roundIndex, user])

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
    <main className="app">
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

      <StageBar stage={round.stage} attempts={round.attempts} />

      <ClipPlayer
        stage={round.stage}
        status={status}
        mode={clipMode}
        loop={loop}
        onLoopChange={setLoop}
        onPlay={() => play(round.song.startAt, STAGES[round.stage], loop)}
        onStop={stop}
      />

      {phase === 'playing' ? (
        <GuessInput
          catalogue={catalogue}
          disabled={false}
          onGuess={onGuess}
          onGuessArtist={mode === 'pick' ? onGuessArtist : undefined}
          onSkip={onSkip}
          skipLabel={round.stage >= MAX_STAGE ? 'استسلمت' : 'تخطّي'}
        />
      ) : (
        <RoundResult round={round} onNext={onNext} isLast={roundIndex + 1 >= lineup.length} />
      )}
    </main>
  )
}


/**
 * The catalogue ships without previews — they are fetched, not committed — so
 * say what to run rather than starting a game with nothing to play.
 */
function NoPreviews() {
  return (
    <main className="app">
      <section className="complete">
        <h2>لا توجد مقاطع بعد</h2>
        <p className="complete-note">
          الكتالوج يحتوي على {allSongs.length} أغنية بدون روابط تشغيل. شغّل هذا الأمر
          لجلبها من آبل:
        </p>
        <pre className="cmd">npm run previews</pre>
        <p className="complete-note">
          ثم أعد تشغيل الخادم. راجع README للخيارات.
        </p>
      </section>
    </main>
  )
}

type Screen = 'home' | 'solo' | 'challenge' | 'pick' | 'party' | 'account' | 'board'

export default function App() {
  // #admin opens the clip review console: every clip, what it matched, and a
  // verdict. Kept off the player-facing UI, reachable by link.
  const [hash, setHash] = useState(() => window.location.hash)
  const [screen, setScreen] = useState<Screen>('home')
  const { user, available: accountsAvailable } = useAuth()

  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#admin' || hash === '#review') return <Admin songs={allSongs} />
  // #audio reports what the audio stack does on the device in hand — the only
  // way to diagnose an iOS failure from a machine that has no iOS.
  if (hash === '#audio') return <AudioCheck songs={catalogue} />
  if (catalogue.length === 0) return <NoPreviews />

  if (screen === 'solo') return <Game onHome={() => setScreen('home')} />
  if (screen === 'challenge') {
    return <Game onHome={() => setScreen('home')} startMode="challenge" />
  }
  if (screen === 'pick') return <Game onHome={() => setScreen('home')} startMode="pick" />
  if (screen === 'account') {
    return (
      <main className="app">
        <AccountPanel user={user} onClose={() => setScreen('home')} />
      </main>
    )
  }
  if (screen === 'board') {
    return (
      <main className="app">
        <Leaderboard meUid={user?.uid ?? null} onClose={() => setScreen('home')} />
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
      playableCount={catalogue.length}
      partyCapacity={maxPlayersFor(partyPool)}
      onSolo={() => setScreen('solo')}
      onChallenge={() => setScreen('challenge')}
      onPick={() => setScreen('pick')}
      accountsAvailable={accountsAvailable}
      playerName={user?.displayName ?? null}
      onAccount={() => setScreen('account')}
      onBoard={() => setScreen('board')}
      onParty={() => setScreen('party')}
    />
  )
}
