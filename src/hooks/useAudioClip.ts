import { useCallback, useEffect, useRef, useState } from 'react'

export type ClipStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'missing' | 'error'

/**
 * How the clip is being played.
 *  - 'buffer'  decoded into memory; sample-accurate slicing
 *  - 'element' an <audio> tag seeked with currentTime; works cross-origin
 *              without CORS, but the window is only accurate to a few tens
 *              of milliseconds, which shows at the 0.1s stage
 */
export type ClipMode = 'buffer' | 'element'

let ctx: AudioContext | null = null
const cache = new Map<string, AudioBuffer>()
/** URLs known to refuse a cross-origin fetch — don't retry the buffer path. */
const elementOnly = new Set<string>()

/** Created lazily: browsers refuse an AudioContext before a user gesture. */
function audioContext(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as {
    webkitAudioContext: typeof AudioContext
  }).webkitAudioContext)()
  return ctx
}

/**
 * Wake the audio hardware inside the user gesture that asked for it.
 *
 * iOS only lets an AudioContext leave the suspended state when it is created
 * and resumed synchronously within a gesture handler. Awaiting the clip fetch
 * first — as this hook used to — spends the gesture, and every later resume()
 * is ignored, so nothing ever plays. Desktop and Android are far laxer, which
 * is why this only showed up on iPhones.
 *
 * Must be called before the first await in any play path.
 */
function unlockAudio(): AudioContext {
  const context = audioContext()
  if (context.state === 'suspended') void context.resume()
  try {
    // Starting a silent one-sample buffer is what actually marks the context
    // as running on iOS; resume() on its own is not always enough.
    const primer = context.createBufferSource()
    primer.buffer = context.createBuffer(1, 1, context.sampleRate)
    primer.connect(context.destination)
    primer.start(0)
  } catch {
    // Already running, or the context refused a second primer — harmless.
  }
  return context
}

/**
 * Plays an exact window of an audio file.
 *
 * A 0.1s clip is far below what `<audio>` + currentTime can reliably hit, so
 * the file is decoded once into memory and each stage plays a precise slice of
 * that buffer. Remote previews (Apple's, say) are only fetchable that way if
 * the host sends CORS headers; when it doesn't, playback falls back to an
 * <audio> element, which any origin allows.
 */
export function useAudioClip(url: string) {
  const [status, setStatus] = useState<ClipStatus>('idle')
  const [mode, setMode] = useState<ClipMode>('buffer')
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const elRef = useRef<HTMLAudioElement | null>(null)
  const stopTimer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop()
      } catch {
        // Already stopped — the node is single-use, nothing to clean up.
      }
      sourceRef.current = null
    }
    if (elRef.current) {
      elRef.current.pause()
    }
    if (stopTimer.current !== null) {
      window.clearTimeout(stopTimer.current)
      stopTimer.current = null
    }
    setStatus((s) => (s === 'playing' ? 'ready' : s))
  }, [])

  // A new song means the old clip must not keep playing over it.
  useEffect(() => {
    stop()
    elRef.current = null
    setMode(elementOnly.has(url) ? 'element' : 'buffer')
    setStatus(cache.has(url) ? 'ready' : 'idle')
  }, [url, stop])

  useEffect(() => stop, [stop])

  const loadBuffer = useCallback(async (): Promise<AudioBuffer | null> => {
    const hit = cache.get(url)
    if (hit) return hit

    setStatus('loading')
    try {
      const res = await fetch(url)
      if (res.status === 404) {
        setStatus('missing')
        return null
      }
      if (!res.ok) {
        setStatus('error')
        return null
      }
      const bytes = await res.arrayBuffer()
      const buffer = await audioContext().decodeAudioData(bytes)
      cache.set(url, buffer)
      setStatus('ready')
      return buffer
    } catch {
      // A cross-origin refusal throws here rather than returning a response,
      // so treat any fetch failure on a remote URL as "use the element path".
      if (/^https?:\/\//i.test(url)) {
        elementOnly.add(url)
        setMode('element')
        setStatus('ready')
        return null
      }
      setStatus('error')
      return null
    }
  }, [url])

  const playViaElement = useCallback(
    (startAt: number, duration: number) => {
      let el = elRef.current
      if (!el) {
        el = new Audio(url)
        el.preload = 'auto'
        elRef.current = el
      }
      const armStop = () => {
        stopTimer.current = window.setTimeout(() => {
          el!.pause()
          setStatus('ready')
        }, duration * 1000)
      }

      // Seeking needs metadata, but iOS needs play() called in the gesture, so
      // start playback now and seek as soon as the duration is known rather
      // than waiting for metadata before playing at all.
      const seekAndArm = () => {
        try {
          el!.currentTime = startAt
        } catch {
          // Not seekable yet; the clip simply starts from the top.
        }
        setStatus('playing')
        armStop()
      }

      el.play().then(
        () => {
          if (el!.readyState >= 1) seekAndArm()
          else el!.addEventListener('loadedmetadata', seekAndArm, { once: true })
        },
        () => setStatus('error'),
      )
      el.addEventListener('error', () => setStatus('missing'), { once: true })
    },
    [url],
  )

  /** Slice an already-decoded buffer. Synchronous, so it keeps the gesture. */
  const startFromBuffer = useCallback(
    (context: AudioContext, buffer: AudioBuffer, startAt: number, duration: number) => {
      // Never run past the end of the file, however the clip window was set.
      const offset = Math.min(startAt, Math.max(0, buffer.duration - 0.05))
      const length = Math.min(duration, buffer.duration - offset)
      if (length <= 0) return

      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.start(0, offset, length)
      sourceRef.current = source
      setStatus('playing')

      source.onended = () => {
        if (sourceRef.current === source) sourceRef.current = null
        setStatus('ready')
      }
      // onended can lag on some browsers; this keeps the button state honest.
      stopTimer.current = window.setTimeout(
        () => setStatus((s) => (s === 'playing' ? 'ready' : s)),
        length * 1000 + 120,
      )
    },
    [],
  )

  /**
   * Play `duration` seconds starting `startAt` seconds into the file.
   *
   * Every branch that actually starts audio runs synchronously. iOS only
   * honours playback started within the gesture itself, and the previous
   * version awaited the clip fetch before deciding how to play — so on the
   * first tap, when nothing is decoded yet, the fallback fired after the
   * gesture had expired and iOS stayed silent. Chrome allowed it, which hid
   * the fault on Android.
   */
  const play = useCallback(
    async (startAt: number, duration: number) => {
      stop()
      const context = unlockAudio()
      const decoded = cache.get(url)

      if (decoded && !elementOnly.has(url)) {
        startFromBuffer(context, decoded, startAt, duration)
        return
      }

      // Nothing decoded yet: play through the element now, while the gesture
      // still counts, and decode in the background so later stages get exact
      // slicing.
      playViaElement(startAt, duration)
      if (!elementOnly.has(url)) void loadBuffer()
    },
    [loadBuffer, playViaElement, startFromBuffer, stop, url],
  )

  return { status, mode, play, stop, preload: loadBuffer }
}
