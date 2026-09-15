import { useState } from 'react'
import type { Song } from '../game/types'

type Line = { label: string; value: string; ok?: boolean }

/**
 * Reports what the audio stack actually does on this device.
 *
 * iOS failures are invisible from a development machine — every check here runs
 * inside the tap that starts it, in the same order the game uses, so the result
 * reflects the real constraints rather than a guess about them.
 */
export function AudioCheck({ songs }: { songs: Song[] }) {
  const [lines, setLines] = useState<Line[]>([])
  const [busy, setBusy] = useState(false)
  const song = songs.find((s) => s.previewUrl)

  async function run() {
    if (!song?.previewUrl) return
    setBusy(true)
    const out: Line[] = []
    const add = (label: string, value: string, ok?: boolean) => {
      out.push({ label, value, ok })
      setLines([...out])
    }

    add('User agent', navigator.userAgent.slice(0, 80))

    // 1. context, created and resumed inside this tap
    let ctx: AudioContext | null = null
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new Ctor()
      add('AudioContext created', ctx.state, true)
      if (ctx.state === 'suspended') {
        await ctx.resume()
        // Read through a fresh binding: TypeScript still has the state narrowed
        // to 'suspended' from the guard and cannot see that resume() changed it.
        const resumed: string = ctx.state
        add('After resume()', resumed, resumed === 'running')
      }
      const primer = ctx.createBufferSource()
      primer.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
      primer.connect(ctx.destination)
      primer.start(0)
      add('Silent primer started', 'ok', true)
      const state: string = ctx.state
      add('Context state now', state, state === 'running')
    } catch (e) {
      add('AudioContext', String(e), false)
    }

    // 2. an audible tone, proving output works at all — independent of network
    try {
      if (ctx) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        gain.gain.value = 0.15
        osc.frequency.value = 440
        osc.connect(gain).connect(ctx.destination)
        osc.start()
        osc.stop(ctx.currentTime + 0.4)
        add('Played a 0.4s test tone', 'did you hear it?', true)
      }
    } catch (e) {
      add('Test tone', String(e), false)
    }

    // 3. can the clip be fetched at all (CORS)
    let bytes: ArrayBuffer | null = null
    try {
      const res = await fetch(song.previewUrl)
      add('fetch(preview)', `HTTP ${res.status}`, res.ok)
      if (res.ok) bytes = await res.arrayBuffer()
    } catch (e) {
      add('fetch(preview)', `blocked — ${String(e).slice(0, 60)}`, false)
    }

    // 4. can it be decoded
    if (bytes && ctx) {
      try {
        const buf = await ctx.decodeAudioData(bytes)
        add('decodeAudioData', `${buf.duration.toFixed(1)}s decoded`, true)
      } catch (e) {
        add('decodeAudioData', String(e).slice(0, 60), false)
      }
    }

    // 5. the <audio> fallback
    try {
      const el = new Audio(song.previewUrl)
      await el.play()
      add('<audio>.play()', 'resolved — playing', true)
      window.setTimeout(() => el.pause(), 1500)
    } catch (e) {
      add('<audio>.play()', String(e).slice(0, 70), false)
    }

    setBusy(false)
  }

  return (
    <main className="app">
      <section className="complete">
        <h2>فحص الصوت</h2>
        <p className="complete-note">
          اضغط الزر مرة واحدة. سيُشغّل نغمة قصيرة ثم مقطعاً، ويعرض ما نجح وما فشل.
        </p>
        <button className="btn btn-next" onClick={run} disabled={busy || !song}>
          {busy ? 'جارٍ الفحص…' : 'ابدأ الفحص'}
        </button>

        {lines.length > 0 && (
          <ul className="recap" style={{ marginTop: 16 }}>
            {lines.map((l, i) => (
              <li key={i} className={l.ok === false ? 'recap-lost' : 'recap-won'}>
                <span className="recap-mark">{l.ok === false ? '✗' : l.ok ? '✓' : '·'}</span>
                <span className="recap-title">{l.label}</span>
                <span className="recap-artist">{l.value}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="adm-foot">
          <a href="#">← عودة للعبة</a>
        </p>
      </section>
    </main>
  )
}
