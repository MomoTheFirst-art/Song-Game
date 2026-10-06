import { wrongGuesses } from '../game/types'
import type { Attempt } from '../game/types'

/**
 * So a player does not spend a stage re-guessing what they already tried. The
 * guesses come from the autocomplete, so the label is always a real title.
 */
export function WrongGuesses({ attempts }: { attempts: Attempt[] }) {
  const wrong = wrongGuesses(attempts)
  if (wrong.length === 0) return null

  return (
    <ul className="wrongs" aria-label="تخميناتك الخاطئة">
      {wrong.map((label, i) => (
        <li key={`${label}-${i}`} className="wrong-chip">
          <span className="wrong-mark" aria-hidden="true">✕</span>
          {label}
        </li>
      ))}
    </ul>
  )
}
