import { useState } from 'react'
import { isIOS } from '../game/platform'

const KEY = 'song-game:silent-notice-dismissed'

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Tells iPhone players why they might hear nothing.
 *
 * The silent switch mutes web audio outright, and raising the volume does not
 * help — so a player with it on concludes the game is broken. Shown only on
 * iOS, and only until dismissed.
 */
export function SilentSwitchNotice() {
  const [hidden, setHidden] = useState(alreadySeen)
  if (!isIOS || hidden) return null

  return (
    <aside className="silent-note" role="note">
      <span className="silent-icon" aria-hidden="true">🔕</span>
      <div className="silent-body">
        <strong>لمستخدمي آيفون</strong>
        <p>
          أوقف وضع الصامت من المفتاح الجانبي أو مركز التحكم. أثناء تفعيله لن تسمع
          المقاطع حتى لو رفعت الصوت.
        </p>
      </div>
      <button
        className="btn silent-ok"
        onClick={() => {
          try {
            localStorage.setItem(KEY, '1')
          } catch {
            // Storage unavailable — the notice simply returns next visit.
          }
          setHidden(true)
        }}
      >
        فهمت
      </button>
    </aside>
  )
}
