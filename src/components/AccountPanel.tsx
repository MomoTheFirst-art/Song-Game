import { useState } from 'react'
import type { Player } from '../hooks/usePlayer'

interface Props {
  player: Player | null
  onJoin: (name: string) => void
  onRename: (name: string) => void
  onLeave: () => void
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
  const [saved, setSaved] = useState(false)

  // Naming is a localStorage write now, so there is nothing to await and
  // nothing that can fail in a way the player could act on.
  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    if (player) {
      onRename(name)
      setSaved(true)
    } else {
      onJoin(name)
      onClose()
    }
  }

  return (
    <section className="account">
      {!gated && <h2>{player ? 'حسابك' : 'اختر اسمك'}</h2>}
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

        {saved && <p className="notice notice-soft">تم حفظ الاسم ✓</p>}

        <div className="complete-actions">
          <button className="btn btn-next" type="submit" disabled={!name.trim()}>
            {player ? 'حفظ الاسم' : 'ابدأ اللعب'}
          </button>
          {!gated && (
            <button className="btn" type="button" onClick={onClose}>رجوع</button>
          )}
        </div>
      </form>

      <p className="notice notice-soft">
        نتائجك محفوظة على هذا الجهاز. بدون كلمة مرور لا يمكن استعادتها على جهاز آخر.
      </p>

      {player && (
        <button className="linkish" onClick={() => { onLeave(); onClose() }}>
          الخروج والبدء باسم آخر
        </button>
      )}
    </section>
  )
}
