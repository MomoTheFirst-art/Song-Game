import { useCallback, useEffect, useState } from 'react'
import { firebaseConfigured } from '../firebase/app'
import { joinAsPlayer, renamePlayer, signOut, watchAuth, type User } from '../firebase/auth'
import { clearLocalPlayer, loadLocalPlayer, saveLocalPlayer } from '../game/player'

export interface Player {
  id: string
  name: string
  /** True when this identity is a Firebase account, so scores sync. */
  remote: boolean
}

export interface PlayerState {
  player: Player | null
  ready: boolean
  join: (name: string) => Promise<void>
  rename: (name: string) => Promise<void>
  leave: () => Promise<void>
}

/**
 * The current player, from Firebase when it is available and from this device
 * when it is not. Callers do not need to know which: both carry an id that
 * scores attach to.
 */
export function usePlayer(): PlayerState {
  const [remoteUser, setRemoteUser] = useState<User | null>(null)
  const [local, setLocal] = useState(loadLocalPlayer)
  const [ready, setReady] = useState(!firebaseConfigured)

  useEffect(() => {
    if (!firebaseConfigured) return
    return watchAuth((user) => {
      setRemoteUser(user)
      setReady(true)
    })
  }, [])

  const join = useCallback(async (name: string) => {
    // Saved first, so a failure partway through still leaves the player named
    // and playing rather than stuck at the gate.
    const saved = saveLocalPlayer(name)
    setLocal(saved)
    try {
      await joinAsPlayer(name)
    } catch (err) {
      // Anonymous sign-in refused, offline, or not enabled on the project.
      // The local identity already stands in for it.
      console.warn('Playing locally; scores will not sync.', err)
    }
  }, [])

  const rename = useCallback(
    async (name: string) => {
      setLocal(saveLocalPlayer(name))
      if (remoteUser) await renamePlayer(name)
    },
    [remoteUser],
  )

  const leave = useCallback(async () => {
    clearLocalPlayer()
    setLocal(null)
    if (remoteUser) await signOut()
  }, [remoteUser])

  // A Firebase account wins when there is one: it is the identity Firestore
  // and the scoreboard know about.
  const player: Player | null = remoteUser
    ? { id: remoteUser.uid, name: remoteUser.displayName || local?.name || 'لاعب', remote: true }
    : local
      ? { id: local.id, name: local.name, remote: false }
      : null

  return { player, ready, join, rename, leave }
}
