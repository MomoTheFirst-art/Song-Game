import { useEffect, useState } from 'react'
import { firebaseConfigured } from '../firebase/app'
import { watchAuth, type User } from '../firebase/auth'

export interface AuthState {
  user: User | null
  /** False until Firebase has reported once, so the UI never flashes signed-out. */
  ready: boolean
  /** Whether accounts exist in this build at all. */
  available: boolean
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  // With no config there is nothing to wait for, so this starts settled.
  const [ready, setReady] = useState(!firebaseConfigured)

  useEffect(() => {
    if (!firebaseConfigured) return
    return watchAuth((next) => {
      setUser(next)
      setReady(true)
    })
  }, [])

  return { user, ready, available: firebaseConfigured }
}
