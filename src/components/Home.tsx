import { Hero } from './Hero'
import { SilentSwitchNotice } from './SilentSwitchNotice'
import { ar } from '../game/numerals'

interface Props {
  playableCount: number
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
  playableCount, onSolo, onChallenge, onPick, onParty, partyCapacity,
  playerName, onAccount, onBoard,
}: Props) {
  return (
    <main className="app">
      <section className="home">
        <Hero tagline="المقطع يعمل كاملاً — كلما طال استماعك قلّت نقاطك." />
        <SilentSwitchNotice />

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
          <button className="mode" onClick={onPick}>
            <strong>مبتدئ</strong>
            <span>خمّن الفنان بنصف النقاط، أو الأغنية بالكامل</span>
          </button>
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

        <footer className="home-foot">
          <button className="linkish" onClick={onAccount}>
            {playerName ? `مرحباً ${playerName}` : 'حسابك'}
          </button>
          <button className="linkish" onClick={onBoard}>نتائج اللاعبين</button>
          <p className="home-count">{ar(playableCount)} أغنية جاهزة للعب</p>
        </footer>
      </section>
    </main>
  )
}
