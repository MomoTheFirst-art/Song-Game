import { useState } from 'react'
import { authErrorMessage } from '../firebase/auth'
import type { Player } from '../hooks/usePlayer'

interface Props {
  player: Player | null
  onJoin: (name: string) => Promise<void>
  onRename: (name: string) => Promise<void>
  onLeave: () => Promise<void>
  onClose: () => void
  /** Shown as the gate before the game, where there is no "back" to offer. */
  gated?: boolean
}

/**
 * A name, and nothing else. No password is asked for, stored, or possible.
 *
 * What that costs is said on screen rather than only in the code: with no
 * credential there is nothing to prove the account was yours, so it lives on
 * this device and cannot be recovered elsewhere.
 */
export function AccountPanel({ player, onJoin, onRename, onLeave, onClose, gated = false }: Props) {
  const [name, setName] = useState(player?.name ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !name.trim()) return
    setBusy(true)
    setError(null)
    try {
      if (player) {
        await onRename(name)
        setSaved(true)
      } else {
        await onJoin(name)
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
      <h2>{player ? 'حسابك' : 'اختر اسمك'}</h2>
      <p className="complete-note">
        {player
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
            {busy ? 'لحظة…' : player ? 'حفظ الاسم' : 'ابدأ اللعب'}
          </button>
          {!gated && (
            <button className="btn" type="button" onClick={onClose}>رجوع</button>
          )}
        </div>
      </form>

      <p className="notice notice-soft">
        اسمك ونتائجك محفوظة على هذا الجهاز وهذا المتصفح. بدون كلمة مرور لا يمكن
        استعادة الحساب على جهاز آخر.
      </p>

      {player && !player.remote && (
        <p className="notice notice-soft">
          نتائجك محفوظة محلياً فقط — لوحة النتائج المشتركة غير متاحة الآن.
        </p>
      )}

      {player && (
        <button className="linkish" onClick={() => void onLeave().then(onClose)}>
          الخروج والبدء باسم آخر
        </button>
      )}
    </section>
  )
}
