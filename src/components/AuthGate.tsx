import { AccountPanel } from './AccountPanel'
import type { Player } from '../hooks/usePlayer'

interface Props {
  player: Player | null
  ready: boolean
  onJoin: (name: string) => Promise<void>
  onRename: (name: string) => Promise<void>
  onLeave: () => Promise<void>
  children: React.ReactNode
}

/**
 * Nobody plays without a name.
 *
 * The gate deliberately does not depend on a backend being reachable. Joining
 * falls back to a device-local identity when Firebase is unavailable, so a
 * console toggle can never leave the game unplayable — it only decides whether
 * scores sync.
 */
export function AuthGate({ player, ready, onJoin, onRename, onLeave, children }: Props) {
  if (!ready) {
    return (
      <main className="app">
        <section className="complete">
          <p className="complete-note">جارٍ التحميل…</p>
        </section>
      </main>
    )
  }

  if (!player) {
    return (
      <main className="app">
        <h1 className="logo">🎵 خمّن الأغنية</h1>
        <AccountPanel
          player={null}
          onJoin={onJoin}
          onRename={onRename}
          onLeave={onLeave}
          onClose={() => {}}
          gated
        />
      </main>
    )
  }

  return <>{children}</>
}
