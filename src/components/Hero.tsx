import { STAGES } from '../game/stages'
import { ar } from '../game/numerals'

/**
 * The wordmark is the game's own ladder.
 *
 * A music note says "something to do with songs"; the ladder says what this
 * actually is — you get one second, and every wrong guess buys you more at a
 * price. It is the one thing no other song app's home screen would show, so it
 * carries the screen and everything around it stays quiet.
 */
export function Hero({ tagline }: { tagline?: string }) {
  const [first, ...rest] = STAGES

  return (
    <header className="hero">
      <h1 className="hero-name">خمّن الأغنية</h1>
      <p className="hero-ladder" aria-label={`يبدأ المقطع من ${ar(first)} ثانية ويطول حتى ${ar(STAGES[STAGES.length - 1])}`}>
        <span className="hero-first">{ar(first)}</span>
        <span className="hero-rest" aria-hidden="true">
          {rest.map((s) => (
            <span key={s}>{ar(s)}</span>
          ))}
        </span>
        <span className="hero-unit">ثانية</span>
      </p>
      {tagline && <p className="hero-tagline">{tagline}</p>}
    </header>
  )
}
