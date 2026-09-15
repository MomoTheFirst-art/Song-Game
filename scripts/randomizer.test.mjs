import { test } from 'node:test'
import assert from 'node:assert/strict'
import { practiceSongs, dailySongs, shuffle, DAILY_ORDER } from '../src/game/daily.ts'
import { readFileSync } from 'node:fs'

const catalogue = JSON.parse(readFileSync(new URL('../src/data/songs.json', import.meta.url), 'utf8'))

test('shuffle returns a permutation and leaves the input alone', () => {
  const src = [1, 2, 3, 4, 5, 6, 7, 8]
  const frozen = src.slice()
  const out = shuffle(src)
  assert.deepEqual(src, frozen, 'the caller’s array must not be mutated')
  assert.equal(out.length, src.length)
  assert.deepEqual([...out].sort((a, b) => a - b), frozen, 'same members, reordered')
})

test('shuffle actually reorders over repeated runs', () => {
  const src = Array.from({ length: 20 }, (_, i) => i)
  const orders = new Set(Array.from({ length: 30 }, () => shuffle(src).join(',')))
  assert.ok(orders.size > 20, `expected varied orders, saw ${orders.size}`)
})

test('a practice run is one song per difficulty, in ramp order', () => {
  const run = practiceSongs(catalogue)
  assert.equal(run.length, DAILY_ORDER.length)
  assert.deepEqual(run.map((s) => s.difficulty), DAILY_ORDER)
  assert.equal(new Set(run.map((s) => s.id)).size, run.length, 'no song twice in a run')
})

test('recently played songs are skipped', () => {
  const first = practiceSongs(catalogue)
  const exclude = new Set(first.map((s) => s.id))
  for (let i = 0; i < 25; i++) {
    const next = practiceSongs(catalogue, exclude)
    for (const s of next) {
      assert.ok(!exclude.has(s.id), `${s.id} was excluded but still picked`)
    }
  }
})

test('an exhausted tier falls back rather than returning nothing', () => {
  // Exclude the entire catalogue: every tier must still yield a song.
  const all = new Set(catalogue.map((s) => s.id))
  const run = practiceSongs(catalogue, all)
  assert.equal(run.length, DAILY_ORDER.length, 'must not collapse when everything is excluded')
})

test('successive practice runs vary', () => {
  const seen = new Set()
  let exclude = new Set()
  for (let i = 0; i < 12; i++) {
    const run = practiceSongs(catalogue, exclude)
    seen.add(run.map((s) => s.id).join(','))
    exclude = new Set([...exclude, ...run.map((s) => s.id)])
  }
  assert.equal(seen.size, 12, 'every run should differ while fresh songs remain')
})

test('the daily run stays deterministic despite the new randomiser', () => {
  const a = dailySongs(catalogue, '2026-09-15').map((s) => s.id)
  const b = dailySongs(catalogue, '2026-09-15').map((s) => s.id)
  assert.deepEqual(a, b)
  const c = dailySongs(catalogue, '2026-09-16').map((s) => s.id)
  assert.notDeepEqual(a, c, 'a different date should give a different run')
})

test('every song in the catalogue is reachable by the daily draw', () => {
  const drawn = new Set()
  for (let i = 0; i < 400; i++) {
    const day = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10)
    dailySongs(catalogue, day).forEach((s) => drawn.add(s.id))
  }
  const playable = catalogue.length
  assert.ok(drawn.size >= playable * 0.9, `only ${drawn.size}/${playable} songs ever drawn`)
})
