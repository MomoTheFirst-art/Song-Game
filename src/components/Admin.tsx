import { useEffect, useMemo, useState } from 'react'
import { DIFFICULTY_LABEL } from '../game/types'
import type { Song } from '../game/types'
import type { Decisions, Verdict } from '../game/review'
import { approvalsGovern, loadDecisions, saveDecisions, verdictFor } from '../game/review'
import { loadStarts, saveStarts } from '../game/starts'
import { ClipWindow } from './ClipWindow'
import type { Starts } from '../game/starts'
import { STAGES } from '../game/stages'
import { useAudioClip } from '../hooks/useAudioClip'

/** What a player hears at the last stage, and the longest clip to audition. */
const LONGEST = STAGES[STAGES.length - 1]

/** One clip: play it, judge it. */
function ClipRow({
  song,
  verdict,
  onVerdict,
  start,
  onStart,
}: {
  song: Song
  verdict: Verdict | undefined
  onVerdict: (v: Verdict | undefined) => void
  start: number
  onStart: (seconds: number) => void
}) {
  const { status, play, stop } = useAudioClip(song.previewUrl as string)
  const playing = status === 'playing'
  const m = song.matchedAs
  const weak = !m || m.score < 0.8

  return (
    <li className={`adm-row adm-${verdict ?? 'new'}`}>
      <button
        className="btn adm-play"
        onClick={() => (playing ? stop() : play(0, 30))}
        aria-label={playing ? 'إيقاف' : 'تشغيل'}
      >
        {playing ? '■' : '▶'}
      </button>

      <div className="adm-meta">
        <div className="adm-expected">
          <strong>{song.title}</strong>
          <span className="adm-dim">{song.artist}</span>
          <span className="adm-tier">{DIFFICULTY_LABEL[song.difficulty]}</span>
        </div>
        <div className={weak ? 'adm-matched adm-weak' : 'adm-matched'}>
          {m ? (
            <>
              <span>{m.track}</span>
              <span className="adm-dim">{m.artist}</span>
              <span className="adm-score">{m.score}</span>
            </>
          ) : (
            <span className="adm-dim">لا سجل مطابقة</span>
          )}
        </div>

        {/* Where the clip begins. Every stage starts here, so this decides
            whether the hardest one is a hook or an intro nobody can place. */}
        <div className="adm-start">
          <ClipWindow start={start} onStart={onStart} />
          <button
            className="btn adm-audition"
            onClick={() => (playing ? stop() : play(start, LONGEST))}
            title={`اسمع ما يسمعه اللاعب: ${LONGEST} ثانية من هنا`}
          >
            {playing ? '■' : '▶'} {LONGEST}s
          </button>
        </div>
      </div>

      <div className="adm-judge">
        <button
          className={verdict === 'approved' ? 'btn adm-yes adm-on' : 'btn adm-yes'}
          onClick={() => onVerdict(verdict === 'approved' ? undefined : 'approved')}
          title="صحيح — يدخل اللعبة"
        >
          ✓
        </button>
        <button
          className={verdict === 'rejected' ? 'btn adm-no adm-on' : 'btn adm-no'}
          onClick={() => onVerdict(verdict === 'rejected' ? undefined : 'rejected')}
          title="خطأ — يُستبعد"
        >
          ✗
        </button>
      </div>
    </li>
  )
}

/** A song with no clip yet: visible, but there is nothing to hear or judge. */
function PendingRow({ song }: { song: Song }) {
  return (
    <li className="adm-row adm-pending">
      <span className="adm-play adm-waiting" aria-hidden="true">⋯</span>
      <div className="adm-meta">
        <div className="adm-expected">
          <strong>{song.title}</strong>
          <span className="adm-dim">{song.artist}</span>
          <span className="adm-tier">{DIFFICULTY_LABEL[song.difficulty]}</span>
        </div>
        <div className="adm-matched">
          <span className="adm-dim">بانتظار جلب المقطع</span>
        </div>
      </div>
      <span className="adm-dim adm-judge">—</span>
    </li>
  )
}

type Filter = 'all' | 'new' | 'approved' | 'rejected' | 'weak' | 'awaiting'

export function Admin({ songs }: { songs: Song[] }) {
  const [decisions, setDecisions] = useState<Decisions>(loadDecisions)
  const [starts, setStarts] = useState<Starts>(loadStarts)
  const [filter, setFilter] = useState<Filter>('new')
  const [copied, setCopied] = useState('')

  useEffect(() => saveDecisions(decisions), [decisions])
  useEffect(() => saveStarts(starts), [starts])

  const withClips = useMemo(() => songs.filter((s) => s.previewUrl), [songs])
  // Songs still waiting on a lookup have nothing to play, but hiding them made
  // the page look like they had never been added at all.
  const awaiting = useMemo(() => songs.filter((s) => !s.previewUrl), [songs])
  const counts = useMemo(() => {
    let approved = 0, rejected = 0, fresh = 0
    for (const s of withClips) {
      const v = verdictFor(s, decisions)
      if (v === 'approved') approved++
      else if (v === 'rejected') rejected++
      else fresh++
    }
    return { approved, rejected, fresh, awaiting: awaiting.length }
  }, [withClips, decisions, awaiting])

  const shown = useMemo(() => {
    if (filter === 'awaiting') return awaiting
    return withClips.filter((s) => {
      const v = verdictFor(s, decisions)
      if (filter === 'all') return true
      if (filter === 'new') return v === undefined
      if (filter === 'weak') return !s.matchedAs || s.matchedAs.score < 0.8
      return v === filter
    })
  }, [withClips, awaiting, decisions, filter])

  const governing = approvalsGovern(songs, decisions)
  const startCount = Object.keys(starts).length

  function setVerdict(id: string, v: Verdict | undefined) {
    const clip = withClips.find((s) => s.id === id)?.previewUrl
    setDecisions((prev) => {
      const next = { ...prev }
      if (v && clip) next[id] = { verdict: v, clip }
      else delete next[id]
      return next
    })
  }

  function setStart(song: Song, seconds: number) {
    setStarts((prev) => {
      const next = { ...prev }
      // Back at the shipped value there is nothing to override, and keeping
      // the entry would pin the song if the catalogue ever moved it.
      if (seconds === song.startAt) delete next[song.id]
      else next[song.id] = seconds
      return next
    })
  }

  async function copy(what: 'patch' | 'rejected' | 'starts') {
    const text =
      what === 'starts'
        ? JSON.stringify(starts, null, 2)
        : what === 'patch'
        ? JSON.stringify(
            Object.fromEntries(
              withClips
                .map((s) => [s.id, verdictFor(s, decisions)])
                .filter(([, v]) => v)
                .map(([id, v]) => [id as string, v === 'approved']),
            ),
            null,
            2,
          )
        : withClips
            .filter((s) => verdictFor(s, decisions) === 'rejected')
            .map((s) => `${s.id}  |  ${s.titleLatin} — ${s.artistLatin}`)
            .join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(what)
      window.setTimeout(() => setCopied(''), 2000)
    } catch {
      // Clipboard blocked — nothing to fall back to but trying again.
    }
  }

  return (
    <main className="app adm">
      <header className="adm-head">
        <h1>لوحة المراجعة</h1>
        <p className="adm-dim">
          شغّل كل مقطع وتأكد أنه الأغنية الصحيحة. ✓ يدخل اللعبة، ✗ يُستبعد منها.
          الشريط هو المعاينة كاملة (٣٠ ثانية)؛ اسحب الجزء المضيء لتختار الـ١٥ ثانية
          التي يسمعها اللاعب — والشريحة الفاتحة في أوله هي الثانية الأولى.
        </p>
      </header>

      <div className="adm-stats">
        <span className="adm-stat adm-s-yes">✓ {counts.approved}</span>
        <span className="adm-stat adm-s-no">✗ {counts.rejected}</span>
        <span className="adm-stat">بانتظار المراجعة {counts.fresh}</span>
      </div>

      <p className={governing ? 'adm-banner adm-live' : 'adm-banner'}>
        {governing
          ? 'اللعبة تستخدم المقاطع المعتمدة فقط.'
          : 'اعتمد أغنية واحدة على الأقل من كل مستوى لتقتصر اللعبة على المعتمد. المرفوض مستبعد الآن.'}
      </p>

      <div className="adm-tabs">
        {([
          ['new', `جديد (${counts.fresh})`],
          ['weak', 'مشكوك فيه'],
          ['approved', `معتمد (${counts.approved})`],
          ['rejected', `مرفوض (${counts.rejected})`],
          ['awaiting', `بانتظار الجلب (${counts.awaiting})`],
          ['all', `الكل (${withClips.length})`],
        ] as [Filter, string][]).map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? 'tab tab-on' : 'tab'}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="adm-list">
        {shown.map((s) =>
          s.previewUrl ? (
            <ClipRow
              key={s.id}
              song={s}
              verdict={verdictFor(s, decisions)}
              onVerdict={(v) => setVerdict(s.id, v)}
              start={starts[s.id] ?? s.startAt}
              onStart={(seconds) => setStart(s, seconds)}
            />
          ) : (
            <PendingRow key={s.id} song={s} />
          ),
        )}
        {shown.length === 0 && <li className="adm-empty">لا شيء هنا.</li>}
      </ul>

      <div className="adm-actions">
        <button className="btn btn-next" onClick={() => copy('patch')}>
          {copied === 'patch' ? 'تم النسخ ✓' : 'انسخ القرارات (JSON)'}
        </button>
        <button className="btn" onClick={() => copy('rejected')}>
          {copied === 'rejected' ? 'تم النسخ ✓' : 'انسخ المرفوضة'}
        </button>
        <button className="btn" onClick={() => copy('starts')} disabled={startCount === 0}>
          {copied === 'starts' ? 'تم النسخ ✓' : `انسخ نقاط البداية (${startCount})`}
        </button>
        <button
          className="btn"
          onClick={() => {
            setDecisions({})
            setStarts({})
          }}
        >
          مسح الكل
        </button>
      </div>

      <p className="adm-foot">
        القرارات ونقاط البداية محفوظة في هذا المتصفح، وتسري على اللعبة هنا بعد
        إعادة تحميل الصفحة. انسخ الـ JSON لتثبيتها للجميع.
        <br />
        <a href="#">← عودة للعبة</a>
      </p>
    </main>
  )
}
