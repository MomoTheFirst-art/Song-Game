interface Props {
  playableCount: number
  onSolo: () => void
  onParty: () => void
  partyCapacity: number
}

export function Home({ playableCount, onSolo, onParty, partyCapacity }: Props) {
  return (
    <main className="app">
      <section className="home">
        <h1 className="logo">🎵 خمّن الأغنية</h1>
        <p className="complete-note">
          من ثانية واحدة. كل تخمين خاطئ يطيل المقطع — وكل ثانية إضافية تكلّفك نقاطاً.
        </p>

        <div className="home-modes">
          <button className="btn btn-next home-mode" onClick={onSolo}>
            <strong>فردي</strong>
            <span>تحدي اليوم أو تدريب</span>
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

        <p className="complete-note">{playableCount} أغنية جاهزة للعب</p>
      </section>
    </main>
  )
}
