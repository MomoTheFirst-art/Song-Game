/**
 * What the browser tab says, and the icon beside it.
 *
 * Every screen used to read "Guess it under 15s", so a pinned review console
 * and a pinned game were the same tab, and a player with several open could
 * not tell which was which. The tab now names the place you are in.
 */
export interface Page {
  title: string
  /** Shown as the favicon. Empty keeps the game's own icon. */
  icon?: string
}

export type PageId =
  | 'home' | 'daily' | 'challenge' | 'pick' | 'party'
  | 'account' | 'board' | 'admin' | 'audio'

const GAME = 'Guess it under 15s'

/**
 * Each page names itself, and only the home screen carries the game's name.
 * A tab strip gives a few characters before it truncates, so a shared suffix
 * would cost exactly the part that tells two tabs apart.
 */
export const PAGES: Record<PageId, Page> = {
  home: { title: GAME },
  daily: { title: 'تحدي اليوم', icon: '📅' },
  challenge: { title: 'تحدي عشوائي', icon: '🎲' },
  pick: { title: 'مبتدئ', icon: '🎤' },
  party: { title: 'لاعبون متعددون', icon: '👥' },
  account: { title: 'حسابك', icon: '👤' },
  board: { title: 'نتائج اللاعبين', icon: '🏆' },
  admin: { title: 'لوحة المراجعة', icon: '🎛️' },
  audio: { title: 'فحص الصوت', icon: '🔊' },
}

/**
 * An emoji drawn as an SVG favicon.
 *
 * Encoded with encodeURIComponent rather than dropped in raw: an emoji is
 * multi-byte, and a data URI carrying raw UTF-8 is rejected by some browsers
 * and mangled by others. `#` and `&` in any future icon would also end the URI
 * early.
 */
export function emojiIcon(emoji: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<text y=".95em" font-size="90">${emoji}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function applyPage(page: Page, doc: Document = document): void {
  doc.title = page.title

  const link = doc.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!link) return

  // The shipped icon is remembered on the element, not in a module variable.
  // A module variable is captured once per process rather than once per
  // document, so it survives into places it does not describe.
  if (link.getAttribute('data-shipped') === null) {
    link.setAttribute('data-shipped', link.getAttribute('href') ?? '')
  }
  // Falling back to the shipped icon rather than leaving the previous page's:
  // navigating admin → home would otherwise keep the console's icon.
  const next = page.icon ? emojiIcon(page.icon) : (link.getAttribute('data-shipped') ?? '')
  if (link.getAttribute('href') !== next) link.setAttribute('href', next)
}
