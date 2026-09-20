import { useState } from 'react'
import { isIOS, isNativeApp } from '../game/platform'

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
 * iOS in a browser, and only until dismissed: the native app claims a
 * .playback audio session at launch and plays straight through the switch, so
 * there the notice would be telling people to fix something that is not wrong.
 */
export function SilentSwitchNotice() {
  const [hidden, setHidden] = useState(alreadySeen)
  if (!isIOS || isNativeApp || hidden) return null

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
