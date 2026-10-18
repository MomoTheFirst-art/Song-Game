import { AccountPanel } from './AccountPanel'
import { Hero } from './Hero'
import type { Player } from '../hooks/usePlayer'

interface Props {
  player: Player | null
  ready: boolean
  onJoin: (name: string) => void
  onRename: (name: string) => void
  onLeave: () => void
  children: React.ReactNode
}

/**
 * Nobody plays without a name.
 *
 * The name is kept on the device. There is no account and no backend: the
 * gate exists so a score has someone's name on it, not to authenticate
 * anyone.
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
      <main className="app app-gate">
        <Hero />
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
