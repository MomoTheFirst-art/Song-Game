import { useState } from 'react'
import { authErrorMessage, joinAsPlayer, renamePlayer, signOut, type User } from '../firebase/auth'

interface Props {
  user: User | null
  onClose: () => void
  /** Shown as the gate before the game, where there is no "back" to offer. */
  gated?: boolean
}

/**
 * A name, and nothing else.
 *
 * No password is asked for, stored, or possible. What that costs is worth
 * saying out loud on the screen rather than only in the code: without a
 * credential there is nothing to prove the account was yours, so it lives in
 * this browser and cannot be recovered elsewhere.
 */
export function AccountPanel({ user, onClose, gated = false }: Props) {
  const [name, setName] = useState(user?.displayName ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (user) {
        await renamePlayer(name)
        setSaved(true)
      } else {
        await joinAsPlayer(name)
        onClose()
      }
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="account">
      <h2>{user ? 'حسابك' : 'اختر اسمك'}</h2>
      <p className="complete-note">
        {user
          ? 'نتائجك محفوظة على هذا الاسم.'
          : 'اكتب اسماً لتبدأ. لا حاجة لكلمة مرور ولا بريد إلكتروني.'}
      </p>

      <form className="account-form" onSubmit={submit}>
        <label className="field">
          <span>اسم اللاعب</span>
          <input
            className="guess-input"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setSaved(false)
            }}
            maxLength={40}
            minLength={2}
            required
            autoComplete="nickname"
            placeholder="مثال: محمد"
          />
        </label>

        {error && <p className="notice notice-warn">{error}</p>}
        {saved && <p className="notice notice-soft">تم حفظ الاسم ✓</p>}

        <div className="complete-actions">
          <button className="btn btn-next" type="submit" disabled={busy || !name.trim()}>
            {busy ? 'لحظة…' : user ? 'حفظ الاسم' : 'ابدأ اللعب'}
          </button>
          {!gated && (
            <button className="btn" type="button" onClick={onClose}>رجوع</button>
          )}
        </div>
      </form>

      {user ? (
        <>
          <p className="notice notice-soft">
            نتائجك محفوظة على هذا الجهاز وهذا المتصفح. مسح بيانات الموقع أو الانتقال
            لجهاز آخر يعني بداية جديدة — لا توجد كلمة مرور لاستعادتها.
          </p>
          <button className="linkish" onClick={() => void signOut().then(onClose)}>
            الخروج والبدء باسم آخر
          </button>
        </>
      ) : (
        <p className="notice notice-soft">
          اسمك ونتائجك تُحفظ على هذا الجهاز. بدون كلمة مرور لا يمكن استعادة الحساب
          على جهاز آخر.
        </p>
      )}
    </section>
  )
}
