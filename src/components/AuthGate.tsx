import { useEffect, useState } from 'react'
import { AccountPanel } from './AccountPanel'
import { firebaseConfigured, loadFirebase } from '../firebase/app'
import type { User } from '../firebase/auth'

interface Props {
  user: User | null
  ready: boolean
  children: React.ReactNode
}

/**
 * Nobody plays without an account.
 *
 * The failure mode matters more than the happy path here. If the project's
 * email provider is off, or Firebase cannot load at all, a naive gate shows a
 * spinner forever and the whole game looks broken with no clue why — so an
 * unreachable backend is reported as exactly that, with the fix named.
 */
export function AuthGate({ user, ready, children }: Props) {
  const [reachable, setReachable] = useState<boolean | null>(null)

  useEffect(() => {
    if (!firebaseConfigured) {
      setReachable(false)
      return
    }
    let live = true
    loadFirebase().then((fb) => live && setReachable(Boolean(fb)))
    return () => {
      live = false
    }
  }, [])

  if (reachable === false) {
    return (
      <main className="app">
        <section className="complete">
          <h2>تعذّر الوصول إلى الحساب</h2>
          <p className="complete-note">
            اللعبة تتطلّب تسجيل الدخول، لكن خدمة الحسابات غير متاحة الآن. حاول لاحقاً.
          </p>
        </section>
      </main>
    )
  }

  if (!ready || reachable === null) {
    return (
      <main className="app">
        <section className="complete">
          <p className="complete-note">جارٍ التحميل…</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return (
      <main className="app">
        <h1 className="logo">🎵 خمّن الأغنية</h1>
        {/* onClose is a no-op: there is nowhere to go until they are in. */}
        <AccountPanel user={null} onClose={() => {}} gated />
      </main>
    )
  }

  return <>{children}</>
}
