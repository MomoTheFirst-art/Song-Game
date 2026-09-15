import { useEffect, useState } from 'react'
import { MAX_PLAYERS, MIN_PLAYERS } from '../game/party'

interface Props {
  /** How many players the approved catalogue can supply distinct songs for. */
  capacity: number
  onStart: (names: string[]) => void
  onBack: () => void
}

export function PartySetup({ capacity, onStart, onBack }: Props) {
  const ceiling = Math.min(MAX_PLAYERS, capacity)
  const [count, setCount] = useState(Math.min(2, ceiling))
  const [names, setNames] = useState<string[]>(() => ['', ''])

  useEffect(() => {
    setNames((prev) => {
      const next = prev.slice(0, count)
      while (next.length < count) next.push('')
      return next
    })
  }, [count])

  const tooFewSongs = ceiling < MIN_PLAYERS

  return (
    <section className="setup">
      <h2>لاعبون متعددون</h2>

      {tooFewSongs ? (
        <p className="complete-note">
          لا توجد مقاطع معتمدة كافية بعد. يحتاج كل لاعب إلى ٣ أغانٍ مختلفة.
        </p>
      ) : (
        <>
          <p className="complete-note">
            كل لاعب يخمّن ٣ أغانٍ — سهلة ثم متوسطة ثم صعبة — ولا تتكرر أغنية بين
            اللاعبين.
          </p>

          <label className="field">
            <span>عدد اللاعبين</span>
            <div className="counter">
              <button
                className="btn"
                onClick={() => setCount((c) => Math.max(MIN_PLAYERS, c - 1))}
                disabled={count <= MIN_PLAYERS}
                aria-label="أقل"
              >
                −
              </button>
              <strong className="counter-value">{count}</strong>
              <button
                className="btn"
                onClick={() => setCount((c) => Math.min(ceiling, c + 1))}
                disabled={count >= ceiling}
                aria-label="أكثر"
              >
                +
              </button>
            </div>
          </label>
          {count >= ceiling && (
            <p className="complete-note">الحد الأقصى {ceiling} بعدد المقاطع المعتمدة.</p>
          )}

          <div className="names">
            {names.map((name, i) => (
              <input
                key={i}
                className="guess-input"
                value={name}
                placeholder={`اسم اللاعب ${i + 1}`}
                onChange={(e) =>
                  setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))
                }
                aria-label={`اسم اللاعب ${i + 1}`}
              />
            ))}
          </div>

          <button className="btn btn-next" onClick={() => onStart(names)}>
            ابدأ اللعب
          </button>
        </>
      )}

      <button className="btn" onClick={onBack}>
        رجوع
      </button>
    </section>
  )
}
