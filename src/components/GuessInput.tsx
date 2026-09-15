import { useEffect, useRef, useState } from 'react'
import { searchSongs } from '../game/search'
import type { Song } from '../game/types'

interface Props {
  catalogue: Song[]
  disabled: boolean
  onGuess: (song: Song) => void
  onSkip: () => void
  skipLabel: string
}

export function GuessInput({ catalogue, disabled, onGuess, onSkip, skipLabel }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  const results = open ? searchSongs(catalogue, query) : []

  useEffect(() => setActive(0), [query])

  // Clicking away should dismiss the list without losing what was typed.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  function submit(song: Song) {
    onGuess(song)
    setQuery('')
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + results.length) % results.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submit(results[active])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="guess" ref={boxRef}>
      <div className="guess-row">
        <input
          className="guess-input"
          type="text"
          value={query}
          disabled={disabled}
          placeholder="اكتب اسم الأغنية أو الفنان…"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label="تخمين الأغنية"
          autoComplete="off"
        />
        <button className="btn btn-skip" onClick={onSkip} disabled={disabled}>
          {skipLabel}
        </button>
      </div>

      {results.length > 0 && (
        <ul className="suggestions" role="listbox">
          {results.map((song, i) => (
            <li
              key={song.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'suggestion active' : 'suggestion'}
              onMouseEnter={() => setActive(i)}
              onClick={() => submit(song)}
            >
              <span className="s-title">{song.title}</span>
              <span className="s-artist">{song.artist}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
