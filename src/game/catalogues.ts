import songsData from '../data/songs.json' with { type: 'json' }
import spacetoonData from '../data/spacetoon.json' with { type: 'json' }
import englishData from '../data/english.json' with { type: 'json' }
import type { Song } from './types.ts'

export type GenreId = 'arabic' | 'spacetoon' | 'english'

export interface Genre {
  id: GenreId
  /** What the picker calls it. */
  label: string
  /** One line under the picker, in the interface's own voice. */
  note: string
  /**
   * The script its titles are written in. The guess field follows it, so a
   * Latin title is never typed into a right-to-left box.
   */
  dir: 'rtl' | 'ltr'
  /**
   * True where the performer is the work itself — a cartoon opening belongs to
   * its show, not to whichever singer recorded the dub. Guessing the artist is
   * then the same answer as guessing the song, so مبتدئ has nothing to offer.
   */
  performerIsWork?: boolean
  all: Song[]
}

/**
 * Catalogues are separate files, not one file with a tag, because they are
 * never mixed: the guess list for an Arabic round must not offer an English
 * title, and a lookup pass tuned for cartoon themes would be wrong for the
 * song catalogue. Keeping them apart is what makes each of those simple.
 */
export const GENRES: Genre[] = [
  {
    id: 'arabic',
    label: 'أغاني عربية',
    note: 'الطرب والبوب العربي، من أم كلثوم إلى اليوم.',
    dir: 'rtl',
    all: songsData as Song[],
  },
  {
    id: 'spacetoon',
    label: 'سبيستون',
    note: 'شارات الكرتون التي كبرنا عليها.',
    dir: 'rtl',
    performerIsWork: true,
    all: spacetoonData as Song[],
  },
  {
    id: 'english',
    label: 'English',
    note: 'Hip-hop, mostly.',
    dir: 'ltr',
    all: englishData as Song[],
  },
]

export const DEFAULT_GENRE: GenreId = 'arabic'

export const genreById = (id: GenreId): Genre =>
  GENRES.find((g) => g.id === id) ?? GENRES[0]

/** Every song the review console judges, across all catalogues. */
export const everySong: Song[] = GENRES.flatMap((g) => g.all)

const KEY = 'song-game:genre:v1'

export function loadGenre(): GenreId {
  try {
    const raw = localStorage.getItem(KEY)
    return GENRES.some((g) => g.id === raw) ? (raw as GenreId) : DEFAULT_GENRE
  } catch {
    return DEFAULT_GENRE
  }
}

export function saveGenre(id: GenreId): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Storage unavailable — the choice lasts for this session only.
  }
}
