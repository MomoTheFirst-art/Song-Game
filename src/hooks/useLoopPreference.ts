import { useCallback, useState } from 'react'

/**
 * Whether clips repeat until stopped.
 *
 * Kept here rather than in either game's state because a player who wants
 * looping wants it for every round, in solo and in a party alike, and the two
 * modes own separate trees — threading it through both would mean the box
 * silently reset between songs. Only one player is ever mounted, so reading
 * the stored value at mount is enough to keep them in step.
 */
const KEY = 'song-game:loop'

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    // Private mode, or storage blocked entirely. Not looping is the safe default.
    return false
  }
}

export function useLoopPreference(): [boolean, (loop: boolean) => void] {
  const [loop, setLoopState] = useState(read)

  const setLoop = useCallback((next: boolean) => {
    setLoopState(next)
    try {
      window.localStorage.setItem(KEY, next ? '1' : '0')
    } catch {
      // The preference just does not survive the session.
    }
  }, [])

  return [loop, setLoop]
}
