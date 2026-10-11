import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, emojiIcon, applyPage } from '../src/game/page.ts'

/** The smallest stand-in for a document that applyPage actually touches. */
const fakeDoc = (shipped = '/guitar.svg') => {
  const link = {
    attrs: { rel: 'icon', href: shipped },
    getAttribute(k) { return this.attrs[k] ?? null },
    setAttribute(k, v) { this.attrs[k] = v },
  }
  return { title: '', querySelector: () => link, link }
}

test('every page names itself, and only home carries the game name', () => {
  for (const [id, p] of Object.entries(PAGES)) {
    assert.ok(p.title.length > 0, `${id} has no title`)
    if (id === 'home') continue
    assert.ok(p.icon, `${id} should carry its own icon`)
    assert.ok(
      !p.title.includes('Guess it'),
      `${id} must not repeat the game name — a tab strip truncates away the part that tells two tabs apart`,
    )
  }
  assert.equal(PAGES.home.icon, undefined, 'home keeps the shipped icon')
  assert.equal(PAGES.admin.title, 'لوحة المراجعة')
})

test('an emoji icon is a legal data URI', () => {
  const uri = emojiIcon('🎛️')
  assert.ok(uri.startsWith('data:image/svg+xml,'))
  assert.ok(!/[<>"🎛]/.test(uri), 'raw markup and multi-byte characters must be encoded')
  assert.ok(decodeURIComponent(uri.slice('data:image/svg+xml,'.length)).includes('🎛️'))
})

test('applying a page sets the title and swaps the icon', () => {
  const doc = fakeDoc()
  applyPage(PAGES.admin, doc)
  assert.equal(doc.title, 'لوحة المراجعة')
  assert.ok(doc.link.getAttribute('href').startsWith('data:image/svg+xml,'))
})

test('leaving a page restores the icon the document shipped with', () => {
  // admin → home used to leave the console's icon on the game.
  const doc = fakeDoc('/Song-Game/guitar.svg')
  applyPage(PAGES.admin, doc)
  applyPage(PAGES.home, doc)
  assert.equal(doc.link.getAttribute('href'), '/Song-Game/guitar.svg')
  assert.equal(doc.title, 'Guess it under 15s')
})

test('a document with no icon link is left alone rather than throwing', () => {
  const doc = { title: '', querySelector: () => null }
  assert.doesNotThrow(() => applyPage(PAGES.board, doc))
  assert.equal(doc.title, PAGES.board.title)
})

// pageFor is duplicated here deliberately: it lives in App.tsx, which node
// cannot import (JSX), and the mapping is the thing worth pinning.
const pageFor = (hash, screen) => {
  if (hash === '#admin' || hash === '#review') return 'admin'
  if (hash === '#audio') return 'audio'
  if (screen === 'solo') return 'daily'
  if (screen === 'challenge') return 'challenge'
  if (screen === 'pick') return 'pick'
  if (screen === 'party') return 'party'
  if (screen === 'account') return 'account'
  if (screen === 'board') return 'board'
  return 'home'
}

test('every screen and hash maps to a page that exists', () => {
  const screens = ['home', 'solo', 'challenge', 'pick', 'party', 'account', 'board']
  const hashes = ['', '#admin', '#review', '#audio']
  const seen = new Set()
  for (const h of hashes) for (const sc of screens) {
    const id = pageFor(h, sc)
    assert.ok(PAGES[id], `${h || '(no hash)'} + ${sc} -> unknown page ${id}`)
    seen.add(id)
  }
  assert.deepEqual([...seen].sort(), Object.keys(PAGES).sort(), 'every page must be reachable')
})

test('the console wins over whatever screen is behind it', () => {
  // #admin renders before the screen switch does, so the tab must agree.
  assert.equal(pageFor('#admin', 'board'), 'admin')
  assert.equal(pageFor('#review', 'party'), 'admin')
  assert.equal(pageFor('#audio', 'solo'), 'audio')
})
