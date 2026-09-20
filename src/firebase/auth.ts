import type { User } from 'firebase/auth'
import { loadFirebase } from './app'

export type { User }

/**
 * Firebase error codes, in Arabic and in the player's terms. The raw messages
 * are English and describe the API rather than what to do next. Anything
 * unrecognised falls back to a generic line instead of leaking a code.
 */
const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'هذا البريد مسجَّل بالفعل. سجّل الدخول بدلاً من إنشاء حساب.',
  'auth/invalid-email': 'صيغة البريد غير صحيحة.',
  'auth/weak-password': 'كلمة المرور قصيرة — استخدم ٦ أحرف على الأقل.',
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة.',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد.',
  'auth/wrong-password': 'كلمة المرور غير صحيحة.',
  'auth/too-many-requests': 'محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.',
  'auth/network-request-failed': 'تعذّر الاتصال. تحقّق من الإنترنت.',
  'auth/operation-not-allowed': 'تسجيل الدخول بالبريد غير مُفعَّل في المشروع بعد.',
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

export async function signUp(email: string, password: string, displayName: string): Promise<User> {
  const { auth } = await required()
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth')
  const { user } = await createUserWithEmailAndPassword(auth, email, password)
  const name = displayName.trim()
  // Set separately: createUserWithEmailAndPassword takes no profile fields, and
  // the leaderboard shows a name rather than an email.
  if (name) await updateProfile(user, { displayName: name })
  return user
}

export async function signIn(email: string, password: string): Promise<User> {
  const { auth } = await required()
  const { signInWithEmailAndPassword } = await import('firebase/auth')
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return user
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
