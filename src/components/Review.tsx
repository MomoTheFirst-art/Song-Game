import { useEffect, useMemo, useState } from 'react'
import { DIFFICULTY_LABEL } from '../game/types'
import type { Song } from '../game/types'
import { useAudioClip } from '../hooks/useAudioClip'

const FLAG_KEY = 'song-game:flagged'

function loadFlags(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FLAG_KEY) || '[]') as string[])
  } catch {
    return new Set()
  }
}

function saveFlags(ids: Set<string>): void {
  try {
    localStorage.setItem(FLAG_KEY, JSON.stringify([...ids]))
  } catch {
    // Storage unavailable — flags stay for this session only.
  }
}

/** Plays one preview in full, so a clip can be judged rather than guessed at. */
function Row({
  song,
  flagged,
  onToggle,
}: {
  song: Song
  flagged: boolean
  onToggle: () => void
}) {
  const { status, play, stop } = useAudioClip(song.previewUrl as string)
  const playing = status === 'playing'
  const m = song.matchedAs

  // Low confidence or no record at all: the rows most likely to be wrong.
  const suspect = !m || (typeof m.score === 'number' && m.score < 0.8)

  return (
    <li className={flagged ? 'rev-row rev-flagged' : 'rev-row'}>
      <button
        className="btn rev-play"
        onClick={() => (playing ? stop() : play(song.startAt, 30))}
        aria-label={playing ? 'إيقاف' : 'تشغيل'}
      >
        {playing ? '■' : '▶'}
      </button>

      <div className="rev-meta">
        <div className="rev-expected">
          <strong>{song.title}</strong>
          <span className="rev-artist">{song.artist}</span>
          <span className="rev-tier">{DIFFICULTY_LABEL[song.difficulty]}</span>
        </div>
        <div className={suspect ? 'rev-matched rev-suspect' : 'rev-matched'}>
          {m ? (
            <>
              <span>{m.track}</span>
              <span className="rev-artist">{m.artist}</span>
              {m.album && <span className="rev-album">{m.album}</span>}
              <span className="rev-score">{m.score}</span>
            </>
          ) : (
            <span className="rev-artist">لا يوجد سجل للمطابقة — لم يُعَد جلبه بعد</span>
          )}
        </div>
      </div>

      <button
        className={flagged ? 'btn rev-flag rev-flag-on' : 'btn rev-flag'}
        onClick={onToggle}
        title="علّم كخطأ"
      >
        {flagged ? '✗' : '○'}
      </button>
    </li>
  )
}

export function Review({ songs }: { songs: Song[] }) {
  const [flags, setFlags] = useState<Set<string>>(loadFlags)
  const [filter, setFilter] = useState<'all' | 'suspect' | 'flagged'>('all')
  const [copied, setCopied] = useState(false)

  useEffect(() => saveFlags(flags), [flags])

  const playable = useMemo(() => songs.filter((s) => s.previewUrl), [songs])
  const shown = useMemo(() => {
    if (filter === 'flagged') return playable.filter((s) => flags.has(s.id))
    if (filter === 'suspect') {
      return playable.filter((s) => !s.matchedAs || (s.matchedAs.score ?? 0) < 0.8)
    }
    return playable
  }, [playable, filter, flags])

  function toggle(id: string) {
    setFlags((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function copyFlagged() {
    const list = playable
      .filter((s) => flags.has(s.id))
      .map((s) => `${s.id}  |  ${s.titleLatin} — ${s.artistLatin}`)
      .join('\n')
    try {
      await navigator.clipboard.writeText(list)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked; the list is on screen to copy by hand.
    }
  }

  const suspectCount = playable.filter((s) => !s.matchedAs || (s.matchedAs.score ?? 0) < 0.8).length

  return (
    <main className="app rev">
      <h1 className="rev-title">مراجعة المقاطع</h1>
      <p className="rev-sub">
        شغّل كل مقطع وتأكد أنه الأغنية الصحيحة. علّم الخطأ بـ ○ ثم انسخ القائمة.
      </p>

      <div className="rev-tabs">
        <button className={filter === 'all' ? 'tab tab-on' : 'tab'} onClick={() => setFilter('all')}>
          الكل ({playable.length})
        </button>
        <button
          className={filter === 'suspect' ? 'tab tab-on' : 'tab'}
          onClick={() => setFilter('suspect')}
        >
          مشكوك فيها ({suspectCount})
        </button>
        <button
          className={filter === 'flagged' ? 'tab tab-on' : 'tab'}
          onClick={() => setFilter('flagged')}
        >
          معلّمة ({flags.size})
        </button>
      </div>

      <ul className="rev-list">
        {shown.map((song) => (
          <Row
            key={song.id}
            song={song}
            flagged={flags.has(song.id)}
            onToggle={() => toggle(song.id)}
          />
        ))}
      </ul>

      {flags.size > 0 && (
        <div className="rev-actions">
          <button className="btn btn-next" onClick={copyFlagged}>
            {copied ? 'تم النسخ ✓' : `انسخ المعلّمة (${flags.size})`}
          </button>
          <button className="btn" onClick={() => setFlags(new Set())}>
            مسح التعليم
          </button>
        </div>
      )}

      <p className="rev-foot">
        <a href="#">← عودة للعبة</a>
      </p>
    </main>
  )
}
