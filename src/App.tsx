import { useCallback, useEffect, useMemo, useState } from 'react'
import { Review } from './components/Review'
import catalogueData from './data/songs.json'
import { ClipPlayer } from './components/ClipPlayer'
import { DayComplete } from './components/DayComplete'
import { GuessInput } from './components/GuessInput'
import { Header } from './components/Header'
import { RoundResult } from './components/RoundResult'
import { StageBar } from './components/StageBar'
import { dailySongs, practiceSongs, todayKey } from './game/daily'
import { roundScore, totalScore } from './game/scoring'
import { MAX_STAGE, STAGES } from './game/stages'
import { loadDaily, recentlyPlayed, rememberPlayed, saveRun } from './game/storage'
import { DIFFICULTY_LABEL } from './game/types'
import type { Mode, RoundState, Song } from './game/types'
import { useAudioClip } from './hooks/useAudioClip'

const allSongs = catalogueData as Song[]
/** A song is playable only once it has a preview URL. */
const catalogue = allSongs.filter((s) => Boolean(s.previewUrl))

function newRound(song: Song): RoundState {
  return { song, stage: 0, attempts: [], status: 'playing' }
}

function Game() {
  const dateKey = useMemo(() => todayKey(), [])
  const [mode, setMode] = useState<Mode>('daily')
  const [lineup, setLineup] = useState<Song[]>(() => dailySongs(catalogue, dateKey))
  const [roundIndex, setRoundIndex] = useState(0)
  const [round, setRound] = useState<RoundState>(() => newRound(dailySongs(catalogue, dateKey)[0]))
  const [finished, setFinished] = useState<RoundState[]>([])
  const [phase, setPhase] = useState<'playing' | 'roundOver' | 'done'>('playing')

  const clipUrl = round.song.previewUrl as string
  const { status, mode: clipMode, play, stop } = useAudioClip(clipUrl)

  // A daily run is one per UTC day — returning players see their result, not a replay.
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
          : practiceSongs(catalogue, recentlyPlayed())
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
          return { ...r, attempts, status: 'won' }
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
          ? { kind: 'correct', songId: song.id }
          : { kind: 'wrong', songId: song.id },
      )
    },
    [advance, phase, round.song.id],
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
      rememberPlayed(lineup.map((s) => s.id))
      saveRun(mode, {
        dateKey,
        score,
        stages: done.map((r) => (r.status === 'won' ? r.stage : null)),
      })
      setPhase('done')
      return
    }

    setRoundIndex((i) => i + 1)
    setRound(newRound(lineup[roundIndex + 1]))
    setPhase('playing')
  }, [dateKey, finished, lineup, mode, round, roundIndex])

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
            onPractice={() => startRun('practice')}
          />
        ) : (
          <section className="complete">
            <h2>لعبت تحدي اليوم بالفعل</h2>
            <p className="complete-note">عُد غداً لتحدٍ جديد، أو جرّب وضع التدريب.</p>
            <button className="btn btn-next" onClick={() => startRun('practice')}>
              جولة تدريب
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

      <p className="difficulty">المستوى: {DIFFICULTY_LABEL[round.song.difficulty]}</p>

      <StageBar stage={round.stage} attempts={round.attempts} />

      <ClipPlayer
        stage={round.stage}
        status={status}
        mode={clipMode}
        onPlay={() => play(round.song.startAt, STAGES[round.stage])}
      />

      {phase === 'playing' ? (
        <GuessInput
          catalogue={catalogue}
          disabled={false}
          onGuess={onGuess}
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

export default function App() {
  // #review opens the verification list: every clip, what it matched, and a
  // way to flag the wrong ones. Kept off the main UI, reachable by link.
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onHash = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (hash === '#review') return <Review songs={allSongs} />
  return catalogue.length > 0 ? <Game /> : <NoPreviews />
}
