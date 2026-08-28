import { useCallback, useEffect, useRef, useState } from 'react'

export type ClipStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'missing' | 'error'

let ctx: AudioContext | null = null
const cache = new Map<string, AudioBuffer>()

/** Created lazily: browsers refuse an AudioContext before a user gesture. */
function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

/**
 * Plays an exact window of an audio file.
 *
 * A 0.1s clip is far below what `<audio>` + currentTime can reliably hit, so
 * the file is decoded once into memory and each stage plays a precise slice
 * of that buffer instead.
 */
export function useAudioClip(url: string) {
  const [status, setStatus] = useState<ClipStatus>('idle')
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
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
    if (stopTimer.current !== null) {
      window.clearTimeout(stopTimer.current)
      stopTimer.current = null
    }
    setStatus((s) => (s === 'playing' ? 'ready' : s))
  }, [])

  // A new song means the old clip must not keep playing over it.
  useEffect(() => {
    stop()
    setStatus(cache.has(url) ? 'ready' : 'idle')
  }, [url, stop])

  useEffect(() => stop, [stop])

  const load = useCallback(async (): Promise<AudioBuffer | null> => {
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
      setStatus('error')
      return null
    }
  }, [url])

  /** Play `duration` seconds starting `startAt` seconds into the file. */
  const play = useCallback(
    async (startAt: number, duration: number) => {
      stop()
      const buffer = await load()
      if (!buffer) return

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
    [load, stop],
  )

  return { status, play, stop, preload: load }
}
