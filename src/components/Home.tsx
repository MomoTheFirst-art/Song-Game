import { SilentSwitchNotice } from './SilentSwitchNotice'

interface Props {
  playableCount: number
  onSolo: () => void
  onChallenge: () => void
  onPick: () => void
  onParty: () => void
  playerName: string | null
  onAccount: () => void
  onBoard: () => void
  partyCapacity: number
}

export function Home({
  playableCount, onSolo, onChallenge, onPick, onParty, partyCapacity,
  playerName, onAccount, onBoard,
}: Props) {
  return (
    <main className="app">
      <section className="home">
        <h1 className="logo">🎵 خمّن الأغنية</h1>
        <SilentSwitchNotice />

        <p className="complete-note">
          من ثانية واحدة. كل تخمين خاطئ يطيل المقطع — وكل ثانية إضافية تكلّفك نقاطاً.
        </p>

        <div className="home-modes">
          <button className="btn btn-next home-mode" onClick={onSolo}>
            <strong>تحدي اليوم</strong>
            <span>خمس أغانٍ، مرة واحدة كل يوم</span>
          </button>
          <button className="btn home-mode" onClick={onChallenge}>
            <strong>تحدي عشوائي</strong>
            <span>خمس أغانٍ عشوائية · العب بلا حدود</span>
          </button>
          <button className="btn home-mode" onClick={onPick}>
            <strong>مبتدئ</strong>
            <span>خمّن الفنان بنصف النقاط، أو الأغنية بالكامل</span>
          </button>
          <button
            className="btn home-mode"
            onClick={onParty}
            disabled={partyCapacity < 2}
          >
            <strong>لاعبون متعددون</strong>
            <span>
              {partyCapacity < 2
                ? 'يحتاج مقاطع معتمدة أكثر'
                : `حتى ${partyCapacity} لاعبين · ٣ أغانٍ لكل لاعب`}
            </span>
          </button>
        </div>

        <div className="home-account">
          <button className="linkish" onClick={onAccount}>
            {playerName ? `مرحباً ${playerName}` : 'حسابك'}
          </button>
          <button className="linkish" onClick={onBoard}>نتائج اللاعبين</button>
        </div>

        <p className="complete-note">{playableCount} أغنية جاهزة للعب</p>
      </section>
    </main>
  )
}
