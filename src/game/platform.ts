/**
 * iOS decides two things for us that no page can override.
 *
 * It silences web audio whenever the ring/silent switch is set to silent — the
 * volume buttons make no difference — and it plays decoded buffers unreliably
 * once an <audio> element has taken the audio session. Both the playback path
 * and the warning shown to players key off this one check.
 */
export const isIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
