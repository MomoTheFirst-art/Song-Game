import type { Song } from './types'

/**
 * Fold the spelling variants players actually type: أ/إ/آ for ا, ة for ه,
 * ى for ي, plus tashkeel and tatweel, which almost nobody types.
 */
export function normalizeArabic(input: string): string {
  return input
    .replace(/[ً-ْٰ]/g, '') // tashkeel
    .replace(/ـ/g, '') // tatweel
    .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
    .replace(/ة/g, 'ه') // ة -> ه
    .replace(/ى/g, 'ي') // ى -> ي
    .replace(/ؤ/g, 'و') // ؤ -> و
    .replace(/ئ/g, 'ي') // ئ -> ي
}

export function normalize(input: string): string {
  return normalizeArabic(input.toLowerCase())
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // Latin diacritics
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function haystack(song: Song): string {
  return normalize(`${song.title} ${song.titleLatin} ${song.artist} ${song.artistLatin}`)
}

/** Suggestions for the guess box, best matches first. */
export function searchSongs(catalogue: Song[], query: string, limit = 8): Song[] {
  const q = normalize(query)
  if (q.length === 0) return []

  const scored: { song: Song; score: number }[] = []
  for (const song of catalogue) {
    const hay = haystack(song)
    const title = normalize(song.title)
    const titleLatin = normalize(song.titleLatin)

    let score = -1
    if (title.startsWith(q) || titleLatin.startsWith(q)) score = 0
    else if (hay.split(' ').some((w) => w.startsWith(q))) score = 1
    else if (hay.includes(q)) score = 2

    if (score >= 0) scored.push({ song, score })
  }

  return scored
    .sort((a, b) => a.score - b.score || a.song.title.localeCompare(b.song.title, 'ar'))
    .slice(0, limit)
    .map((s) => s.song)
}
