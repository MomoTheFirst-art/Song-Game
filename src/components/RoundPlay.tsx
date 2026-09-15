import { useCallback, useState } from 'react'
import { ClipPlayer } from './ClipPlayer'
import { GuessInput } from './GuessInput'
import { RoundResult } from './RoundResult'
import { StageBar } from './StageBar'
import { MAX_STAGE, STAGES } from '../game/stages'
import { DIFFICULTY_LABEL } from '../game/types'
import type { Attempt, RoundState, Song } from '../game/types'
import { useAudioClip } from '../hooks/useAudioClip'

interface Props {
  song: Song
  /** Everything guessable — the answer must not stand out in the suggestions. */
  catalogue: Song[]
  /** Reports the stage the song was solved at, or null if it was lost. */
  onDone: (stage: number | null) => void
  isLast: boolean
}

/**
 * One song, played to its conclusion. Owns the reveal ladder, the clip and the
 * guessing, and reports only the outcome — which is all either game mode needs.
 */
export function RoundPlay({ song, catalogue, onDone, isLast }: Props) {
  const [round, setRound] = useState<RoundState>({
    song,
    stage: 0,
    attempts: [],
    status: 'playing',
  })
  const { status, mode: clipMode, play, stop } = useAudioClip(song.previewUrl as string)
  const over = round.status !== 'playing'

  const advance = useCallback(
    (attempt: Attempt) => {
      stop()
      setRound((r) => {
        const attempts = [...r.attempts, attempt]
        if (attempt.kind === 'correct') return { ...r, attempts, status: 'won' }
        if (r.stage >= MAX_STAGE) return { ...r, attempts, status: 'lost' }
        return { ...r, attempts, stage: r.stage + 1 }
      })
    },
    [stop],
  )

  const onGuess = useCallback(
    (picked: Song) => {
      if (over) return
      advance(
        picked.id === song.id
          ? { kind: 'correct', songId: picked.id }
          : { kind: 'wrong', songId: picked.id },
      )
    },
    [advance, over, song.id],
  )

  return (
    <>
      <p className="difficulty">المستوى: {DIFFICULTY_LABEL[song.difficulty]}</p>

      <StageBar stage={round.stage} attempts={round.attempts} />

      <ClipPlayer
        stage={round.stage}
        status={status}
        mode={clipMode}
        onPlay={() => play(song.startAt, STAGES[round.stage])}
      />

      {over ? (
        <RoundResult
          round={round}
          isLast={isLast}
          onNext={() => {
            stop()
            onDone(round.status === 'won' ? round.stage : null)
          }}
        />
      ) : (
        <GuessInput
          catalogue={catalogue}
          disabled={false}
          onGuess={onGuess}
          onSkip={() => !over && advance({ kind: 'skipped' })}
          skipLabel={round.stage >= MAX_STAGE ? 'استسلمت' : 'تخطّي'}
        />
      )}
    </>
  )
}
