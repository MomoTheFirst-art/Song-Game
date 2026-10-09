import { Hero } from './Hero'
import type { Genre, GenreId } from '../game/catalogues'
import { SilentSwitchNotice } from './SilentSwitchNotice'
import { ar } from '../game/numerals'

interface Props {
  genres: Genre[]
  genreId: GenreId
  onGenre: (id: GenreId) => void
  playableCount: number
  /** Songs in this genre at all, clip or no clip — the empty state needs it. */
  genreTotal: number
  /** Clips fetched but not yet judged. Nothing plays until they are. */
  pendingReview: number
  onSolo: () => void
  onChallenge: () => void
  onPick: () => void
  onParty: () => void
  partyCapacity: number
  playerName: string | null
  onAccount: () => void
  onBoard: () => void
}

export function Home({
  genres, genreId, onGenre,
  playableCount, genreTotal, pendingReview, onSolo, onChallenge, onPick, onParty, partyCapacity,
  playerName, onAccount, onBoard,
}: Props) {
  const genre = genres.find((g) => g.id === genreId) ?? genres[0]
  return (
    <main className="app">
      <section className="home">
        <Hero tagline="المقطع يعمل كاملاً — كلما طال استماعك قلّت نقاطك." />
        <SilentSwitchNotice />

        {/* Catalogues never mix, so this is a choice of which game you are
            playing rather than a filter on one. */}
        <nav className="genres" aria-label="المجموعة">
          {genres.map((g) => (
            <button
              key={g.id}
              className={g.id === genreId ? 'genre genre-on' : 'genre'}
              onClick={() => onGenre(g.id)}
              aria-pressed={g.id === genreId}
              dir={g.dir}
            >
              {g.label}
            </button>
          ))}
        </nav>
        <p className="genre-note" dir={genre.dir}>{genre.note}</p>

        {/* The empty state replaces the modes but never the picker. A genre
            with no clips used to take over the whole screen, and the choice
            is remembered across reloads — so picking one was a one-way door
            out of the game. */}
        {playableCount === 0 ? (
          <div className="home-empty">
            {pendingReview > 0 ? (
              <>
                <p>
                  «{genre.label}» فيه {ar(pendingReview)} مقطعاً بانتظار المراجعة.
                </p>
                <p className="genre-note">
                  لا يُشغَّل أي مقطع قبل اعتماده. راجعها في لوحة المراجعة، أو اختر
                  مجموعة أخرى.
                </p>
              </>
            ) : (
              <>
                <p>
                  لا مقاطع في «{genre.label}» بعد — {ar(genreTotal)} أغنية بانتظار الجلب.
                </p>
                <p className="genre-note">اختر مجموعة أخرى، أو شغّل:</p>
                <pre className="cmd">npm run previews</pre>
              </>
            )}
          </div>
        ) : (
        <>
        {/* One primary, two alternatives, then a different kind of game. Four
            identical cards made every mode look equally weighted, which is
            how you end up never noticing three of them. */}
        <div className="home-modes">
          <button className="mode mode-lead" onClick={onSolo}>
            <strong>تحدي اليوم</strong>
            <span>خمس أغانٍ، مرة واحدة كل يوم</span>
          </button>
          <button className="mode" onClick={onChallenge}>
            <strong>تحدي عشوائي</strong>
            <span>خمس أغانٍ، العب بلا حدود</span>
          </button>
          {/* Pointless where the performer is the work: both halves of the
              choice are the same answer. */}
          {!genre.performerIsWork && (
            <button className="mode" onClick={onPick}>
              <strong>مبتدئ</strong>
              <span>خمّن الفنان بنصف النقاط، أو الأغنية بالكامل</span>
            </button>
          )}
        </div>

        <div className="home-modes home-party">
          <button className="mode" onClick={onParty} disabled={partyCapacity < 2}>
            <strong>لاعبون متعددون</strong>
            <span>
              {partyCapacity < 2
                ? 'يحتاج مقاطع معتمدة أكثر'
                : `حتى ${ar(partyCapacity)} لاعبين، ثلاث أغانٍ لكل لاعب`}
            </span>
          </button>
        </div>
        </>
        )}

        <footer className="home-foot">
          <button className="linkish" onClick={onAccount}>
            {playerName ? `مرحباً ${playerName}` : 'حسابك'}
          </button>
          <button className="linkish" onClick={onBoard}>نتائج اللاعبين</button>
          {playableCount > 0 && (
            <p className="home-count">{ar(playableCount)} أغنية جاهزة للعب</p>
          )}
        </footer>
      </section>
    </main>
  )
}
