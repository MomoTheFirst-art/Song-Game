import { useEffect, useRef, useState } from 'react'
import { searchArtists, searchSongs } from '../game/search'
import type { GuessTarget, Song } from '../game/types'

interface Props {
  catalogue: Song[]
  disabled: boolean
  onGuess: (song: Song) => void
  /**
   * Present only in مبتدئ. Its presence is what turns on the target picker,
   * so the other modes keep the plain single-field input they had.
   */
  onGuessArtist?: (artist: string) => void
  onSkip: () => void
  skipLabel: string
}

export function GuessInput({
  catalogue,
  disabled,
  onGuess,
  onGuessArtist,
  onSkip,
  skipLabel,
}: Props) {
  const picking = Boolean(onGuessArtist)
  // Nothing is preselected when picking: choosing is the decision the mode is
  // built around, and a default would quietly make it for the player.
  const [target, setTarget] = useState<GuessTarget | null>(picking ? null : 'song')
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const songs = open && target === 'song' ? searchSongs(catalogue, query) : []
  const artists = open && target === 'artist' ? searchArtists(catalogue, query) : []
  const count = target === 'artist' ? artists.length : songs.length

  useEffect(() => setActive(0), [query, target])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function chooseTarget(next: GuessTarget) {
    setTarget(next)
    // Whatever was half-typed was aimed at the other question.
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function submitSong(song: Song) {
    onGuess(song)
    setQuery('')
    setOpen(false)
  }

  function submitArtist(artist: string) {
    onGuessArtist?.(artist)
    setQuery('')
    setOpen(false)
  }

  function submitActive() {
    if (target === 'artist') submitArtist(artists[active])
    else submitSong(songs[active])
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (count === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % count)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + count) % count)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submitActive()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="guess" ref={boxRef}>
      {picking && (
        <div className="targets" role="radiogroup" aria-label="ما الذي تخمّنه؟">
          <button
            role="radio"
            aria-checked={target === 'artist'}
            className={target === 'artist' ? 'target target-on' : 'target'}
            onClick={() => chooseTarget('artist')}
            disabled={disabled}
          >
            الفنان <span className="target-worth">نصف النقاط</span>
          </button>
          <button
            role="radio"
            aria-checked={target === 'song'}
            className={target === 'song' ? 'target target-on' : 'target'}
            onClick={() => chooseTarget('song')}
            disabled={disabled}
          >
            الأغنية <span className="target-worth">النقاط كاملة</span>
          </button>
        </div>
      )}

      <div className="guess-row">
        <input
          ref={inputRef}
          className="guess-input"
          type="text"
          value={query}
          disabled={disabled || target === null}
          placeholder={
            target === null
              ? 'اختر ما تريد تخمينه أولاً'
              : target === 'artist'
                ? 'اكتب اسم الفنان…'
                : 'اكتب اسم الأغنية…'
          }
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label={target === 'artist' ? 'تخمين الفنان' : 'تخمين الأغنية'}
          autoComplete="off"
        />
        <button className="btn btn-skip" onClick={onSkip} disabled={disabled}>
          {skipLabel}
        </button>
      </div>

      {target === 'artist' && artists.length > 0 && (
        <ul className="suggestions" role="listbox">
          {artists.map((artist, i) => (
            <li
              key={artist}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'suggestion active' : 'suggestion'}
              onMouseEnter={() => setActive(i)}
              onClick={() => submitArtist(artist)}
            >
              <span className="s-title">{artist}</span>
            </li>
          ))}
        </ul>
      )}

      {target === 'song' && songs.length > 0 && (
        <ul className="suggestions" role="listbox">
          {songs.map((song, i) => (
            <li
              key={song.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'suggestion active' : 'suggestion'}
              onMouseEnter={() => setActive(i)}
              onClick={() => submitSong(song)}
            >
              <span className="s-title">{song.title}</span>
              {/* The artist is deliberately hidden while picking: it would
                  hand over the cheaper answer inside the harder question. */}
              {!picking && <span className="s-artist">{song.artist}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
