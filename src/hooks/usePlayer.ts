import { useCallback, useState } from 'react'
import { clearLocalPlayer, loadLocalPlayer, saveLocalPlayer } from '../game/player'

export interface Player {
  id: string
  name: string
}

export interface PlayerState {
  player: Player | null
  ready: boolean
  join: (name: string) => void
  rename: (name: string) => void
  leave: () => void
}

/**
 * Who is playing. Device-local, and only that.
 *
 * This used to prefer a remote account and fall back to the device when the
 * project was unreachable. The backend is gone, so the fallback is the whole
 * thing — and `ready` is now always true, because nothing has to be awaited
 * before the gate can be shown.
 */
export function usePlayer(): PlayerState {
  const [player, setPlayer] = useState(loadLocalPlayer)

  const join = useCallback((name: string) => setPlayer(saveLocalPlayer(name)), [])
  const rename = useCallback((name: string) => setPlayer(saveLocalPlayer(name)), [])
  const leave = useCallback(() => {
    clearLocalPlayer()
    setPlayer(null)
  }, [])

  return { player, ready: true, join, rename, leave }
}
