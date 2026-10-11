/**
 * What the browser tab says.
 *
 * Every screen used to read "Guess it under 15s", so a pinned review console
 * and a pinned game were the same tab, and several open at once could not be
 * told apart. The text now names the place you are in; the icon stays the
 * game's everywhere, which is what identifies the site among other tabs.
 */
export type PageId =
  | 'home' | 'daily' | 'challenge' | 'pick' | 'party'
  | 'account' | 'board' | 'admin' | 'audio'

const GAME = 'Guess it under 15s'

/**
 * Each page names itself, and only the home screen carries the game's name.
 * A tab strip gives a few characters before it truncates, so a shared suffix
 * would cost exactly the part that tells two tabs apart.
 */
export const PAGES: Record<PageId, string> = {
  home: GAME,
  daily: 'تحدي اليوم',
  challenge: 'تحدي عشوائي',
  pick: 'مبتدئ',
  party: 'لاعبون متعددون',
  account: 'حسابك',
  board: 'نتائج اللاعبين',
  admin: 'لوحة المراجعة',
  audio: 'فحص الصوت',
}

export function applyPage(title: string, doc: Document = document): void {
  doc.title = title
}
