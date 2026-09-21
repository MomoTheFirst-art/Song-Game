import { useState } from 'react'
import { authErrorMessage, signIn, signOut, signUp, type User } from '../firebase/auth'

interface Props {
  user: User | null
  onClose: () => void
  /** Shown as the gate before the game, where there is no "back" to offer. */
  gated?: boolean
}

type Tab = 'in' | 'up'

/**
 * Email/password sign-in. Deliberately the whole of the account surface: the
 * game works signed out, so this only ever has to get someone in or out.
 */
export function AccountPanel({ user, onClose, gated = false }: Props) {
  const [tab, setTab] = useState<Tab>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      if (tab === 'up') await signUp(email, password, name)
      else await signIn(email, password)
      onClose()
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (user) {
    return (
      <section className="account">
        <h2>حسابك</h2>
        <p className="complete-note">
          مسجَّل باسم <strong>{user.displayName || user.email}</strong>
        </p>
        <div className="complete-actions">
          <button className="btn" onClick={() => void signOut().then(onClose)}>
            تسجيل الخروج
          </button>
          <button className="btn btn-next" onClick={onClose}>رجوع</button>
        </div>
      </section>
    )
  }

  return (
    <section className="account">
      <h2>{tab === 'in' ? 'تسجيل الدخول' : 'حساب جديد'}</h2>
      <p className="complete-note">
        {gated
          ? 'أنشئ حساباً للعب. نتائجك تُحفظ وتظهر في لوحة الصدارة.'
          : 'يحفظ نتائجك ويضعك في لوحة الصدارة.'}
      </p>

      <nav className="modes">
        <button className={tab === 'in' ? 'tab tab-on' : 'tab'} onClick={() => setTab('in')}>
          دخول
        </button>
        <button className={tab === 'up' ? 'tab tab-on' : 'tab'} onClick={() => setTab('up')}>
          حساب جديد
        </button>
      </nav>

      <form className="account-form" onSubmit={submit}>
        {tab === 'up' && (
          <label className="field">
            <span>اسمك في لوحة الصدارة</span>
            <input
              className="guess-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              required
              autoComplete="nickname"
            />
          </label>
        )}
        <label className="field">
          <span>البريد الإلكتروني</span>
          <input
            className="guess-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            dir="ltr"
          />
        </label>
        <label className="field">
          <span>كلمة المرور</span>
          <input
            className="guess-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={tab === 'up' ? 'new-password' : 'current-password'}
            dir="ltr"
          />
        </label>

        {error && <p className="notice notice-warn">{error}</p>}

        <div className="complete-actions">
          <button className="btn btn-next" type="submit" disabled={busy}>
            {busy ? 'لحظة…' : tab === 'in' ? 'دخول' : 'إنشاء الحساب'}
          </button>
          {!gated && (
            <button className="btn" type="button" onClick={onClose}>رجوع</button>
          )}
        </div>
      </form>
    </section>
  )
}
