import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  challengeSongs, dailySongs, shuffle, takeRandom, DAILY_ORDER, CHALLENGE_LENGTH,
} from '../src/game/daily.ts'
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

test('takeRandom draws distinct items and never over-draws', () => {
  const pool = Array.from({ length: 10 }, (_, i) => i)
  for (let i = 0; i < 200; i++) {
    const out = takeRandom(pool, 4)
    assert.equal(out.length, 4)
    assert.equal(new Set(out).size, 4, 'indexing at random would repeat; splicing must not')
  }
  assert.equal(takeRandom(pool, 99).length, 10, 'cannot draw more than the pool holds')
  assert.equal(takeRandom([], 3).length, 0)
  const frozen = pool.slice()
  takeRandom(pool, 5)
  assert.deepEqual(pool, frozen, 'the caller’s array must not be mutated')
})

test('a challenge run is five songs, any difficulty, never repeating', () => {
  // The daily cannot repeat a song because each slot is a different tier.
  // This draws every song from one pool, so distinctness is the code's job.
  for (let i = 0; i < 200; i++) {
    const run = challengeSongs(catalogue)
    assert.equal(run.length, CHALLENGE_LENGTH)
    assert.equal(new Set(run.map((s) => s.id)).size, run.length, 'a song was drawn twice')
  }
})

test('a challenge run is not bound to the difficulty ramp', () => {
  // The whole point of the mode: over many runs the shapes must vary, rather
  // than every run reading easy → impossible like the daily.
  const shapes = new Set(
    Array.from({ length: 60 }, () => challengeSongs(catalogue).map((s) => s.difficulty).join(',')),
  )
  assert.ok(shapes.size > 20, `expected varied difficulty shapes, saw ${shapes.size}`)
  const ramped = [...shapes].filter((shape) => shape === DAILY_ORDER.join(','))
  assert.ok(ramped.length <= 1, 'runs should not be reproducing the daily ramp')
})

test('recently played songs are skipped', () => {
  const exclude = new Set(challengeSongs(catalogue).map((s) => s.id))
  for (let i = 0; i < 25; i++) {
    for (const s of challengeSongs(catalogue, exclude)) {
      assert.ok(!exclude.has(s.id), `${s.id} was excluded but still picked`)
    }
  }
})

test('an exhausted catalogue still fills a run rather than returning a short one', () => {
  // Everything excluded: holding songs back must never shorten the run, or a
  // regular player's fifth round would quietly vanish.
  const all = new Set(catalogue.map((s) => s.id))
  const run = challengeSongs(catalogue, all)
  assert.equal(run.length, CHALLENGE_LENGTH, 'must not collapse when everything is excluded')
  assert.equal(new Set(run.map((s) => s.id)).size, run.length, 'and still no repeats')
})

test('a nearly exhausted catalogue mixes fresh songs with repeats, without duplicating', () => {
  // The seam between the two draws: three fresh songs left, so two must come
  // from the excluded pool — and none of them may be one already picked.
  const playable = catalogue.filter((s) => s.previewUrl)
  const fresh = playable.slice(0, 3).map((s) => s.id)
  const exclude = new Set(playable.map((s) => s.id).filter((id) => !fresh.includes(id)))
  for (let i = 0; i < 100; i++) {
    const run = challengeSongs(playable, exclude)
    assert.equal(run.length, CHALLENGE_LENGTH)
    assert.equal(new Set(run.map((s) => s.id)).size, run.length, 'the two draws overlapped')
  }
})

test('successive challenge runs vary', () => {
  const seen = new Set()
  let exclude = new Set()
  for (let i = 0; i < 12; i++) {
    const run = challengeSongs(catalogue, exclude)
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
