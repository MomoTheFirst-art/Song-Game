import type { User } from 'firebase/auth'
import { loadFirebase } from './app'

export type { User }

/**
 * Firebase error codes, in Arabic and in the player's terms. The raw messages
 * are English and describe the API rather than what to do next. Anything
 * unrecognised falls back to a generic line instead of leaking a code.
 */
const MESSAGES: Record<string, string> = {
  'auth/operation-not-allowed': 'الدخول بدون كلمة مرور غير مُفعَّل في المشروع بعد.',
  'auth/admin-restricted-operation': 'الدخول بدون كلمة مرور غير مُفعَّل في المشروع بعد.',
  'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
  'auth/network-request-failed': 'تعذّر الاتصال. تحقّق من الإنترنت.',
}

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code
  if (code && MESSAGES[code]) return MESSAGES[code]
  return 'تعذّر إتمام العملية. حاول مرة أخرى.'
}

async function required() {
  const fb = await loadFirebase()
  if (!fb) throw new Error('Firebase is not configured')
  return fb
}

/**
 * Join with nothing but a name.
 *
 * Anonymous sign-in mints a real uid, which is what the security rules and
 * every score document key on — the account is real, it simply carries no
 * credential. The name goes on the profile so the scoreboard has something to
 * show.
 *
 * The cost of having no password, stated here because it is not obvious from
 * the call site: the account lives in this browser. Clearing site data or
 * moving to another device loses it, and nothing can recover it, because
 * there is no credential with which to prove it was yours.
 */
export async function joinAsPlayer(displayName: string): Promise<User> {
  const { auth } = await required()
  const { signInAnonymously, updateProfile } = await import('firebase/auth')
  const name = displayName.trim()
  const { user } = await signInAnonymously(auth)
  if (name) await updateProfile(user, { displayName: name })
  return user
}

/** Rename an existing player. The uid, and so every score, is untouched. */
export async function renamePlayer(displayName: string): Promise<void> {
  const { auth } = await required()
  const { updateProfile } = await import('firebase/auth')
  const user = auth.currentUser
  if (!user) throw new Error('Not signed in')
  await updateProfile(user, { displayName: displayName.trim() })
}

export async function signOut(): Promise<void> {
  const { auth } = await required()
  const { signOut: fbSignOut } = await import('firebase/auth')
  await fbSignOut(auth)
}

/**
 * Subscribes to sign-in state. Returns a synchronous unsubscribe even though
 * the SDK arrives later — React cleanup cannot await, so unsubscribing before
 * the load finishes has to cancel the pending subscription instead.
 */
export function watchAuth(onChange: (user: User | null) => void): () => void {
  let cancelled = false
  let unsub: (() => void) | null = null

  void (async () => {
    const fb = await loadFirebase()
    if (!fb) {
      if (!cancelled) onChange(null)
      return
    }
    const { onAuthStateChanged } = await import('firebase/auth')
    if (cancelled) return
    unsub = onAuthStateChanged(fb.auth, (user) => {
      if (!cancelled) onChange(user)
    })
  })()

  return () => {
    cancelled = true
    unsub?.()
  }
}
