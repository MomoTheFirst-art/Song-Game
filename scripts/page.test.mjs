import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PAGES, applyPage } from '../src/game/page.ts'

test('every page names itself, and only home carries the game name', () => {
  for (const [id, title] of Object.entries(PAGES)) {
    assert.ok(title.length > 0, `${id} has no title`)
    if (id === 'home') continue
    assert.ok(
      !title.includes('Guess it'),
      `${id} must not repeat the game name — a tab strip truncates away the part that tells two tabs apart`,
    )
  }
  assert.equal(PAGES.admin, 'لوحة المراجعة')
})

test('applying a page sets only the title', () => {
  const doc = { title: 'stale' }
  applyPage(PAGES.admin, doc)
  assert.equal(doc.title, 'لوحة المراجعة')
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
