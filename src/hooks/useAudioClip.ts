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
  if (!ctx) ctx = new AudioContext()
  return ctx
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
      const begin = () => {
        el!.currentTime = startAt
        el!.play().then(
          () => {
            setStatus('playing')
            stopTimer.current = window.setTimeout(() => {
              el!.pause()
              setStatus('ready')
            }, duration * 1000)
          },
          () => setStatus('error'),
        )
      }
      if (el.readyState >= 1) begin()
      else {
        el.addEventListener('loadedmetadata', begin, { once: true })
        el.addEventListener('error', () => setStatus('missing'), { once: true })
        setStatus('loading')
      }
    },
    [url],
  )

  /** Play `duration` seconds starting `startAt` seconds into the file. */
  const play = useCallback(
    async (startAt: number, duration: number) => {
      stop()

      if (mode === 'element' || elementOnly.has(url)) {
        playViaElement(startAt, duration)
        return
      }

      const buffer = await loadBuffer()
      if (!buffer) {
        // loadBuffer may have just switched us to the element path.
        if (elementOnly.has(url)) playViaElement(startAt, duration)
        return
      }

      const context = audioContext()
      if (context.state === 'suspended') await context.resume()

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
    [loadBuffer, mode, playViaElement, stop, url],
  )

  return { status, mode, play, stop, preload: loadBuffer }
}
