import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verdictFor, canFieldRun, playableSongs, awaitingReview } from '../src/game/review.ts'
import { DAILY_ORDER } from '../src/game/daily.ts'

const song = (id, difficulty, extra = {}) => ({
  id, title: id, titleLatin: id, artist: 'x', artistLatin: 'x',
  year: 2000, difficulty, startAt: 0, previewUrl: `https://x/${id}.m4a`, ...extra,
})
const fullSet = (prefix, extra = {}) =>
  DAILY_ORDER.map((tier) => song(`${prefix}-${tier}`, tier, extra))
const on = (s, verdict) => ({ verdict, clip: s.previewUrl })

test('a local verdict overrides the committed one, while it still fits the clip', () => {
  const s = song('a', 'easy', { approved: false })
  assert.equal(verdictFor(s, {}), 'rejected')
  assert.equal(verdictFor(s, { a: on(s, 'approved') }), 'approved')
  assert.equal(
    verdictFor(s, { a: { verdict: 'approved', clip: 'https://x/other.m4a' } }),
    'rejected',
    'a verdict on audio that was replaced no longer applies',
  )
})

test('canFieldRun wants one song in every tier', () => {
  assert.equal(canFieldRun(fullSet('x')), true)
  assert.equal(canFieldRun(fullSet('x').slice(0, 4)), false, 'one tier missing')
  assert.equal(canFieldRun([]), false)
})

test('nothing plays until it is approved', () => {
  // The rule the whole review step exists for: a clip nobody has heard is not
  // a clip the game may use, however many or few of them there are.
  const all = fullSet('x')
  assert.deepEqual(playableSongs(all, {}), [], 'unreviewed is not playable')
  assert.equal(awaitingReview(all, {}), all.length)
})

test('approving songs one at a time makes exactly those playable', () => {
  const all = fullSet('x')
  const decisions = { 'x-easy': on(all[0], 'approved') }
  const out = playableSongs(all, decisions)
  assert.deepEqual(out.map((s) => s.id), ['x-easy'])
  assert.equal(awaitingReview(all, decisions), all.length - 1)
})

test('a rejected clip is never playable, however the rest stand', () => {
  const all = fullSet('x')
  const decisions = Object.fromEntries(all.map((s) => [s.id, on(s, 'approved')]))
  decisions['x-hard'] = on(all[2], 'rejected')
  const out = playableSongs(all, decisions)
  assert.ok(!out.some((s) => s.id === 'x-hard'))
  assert.equal(out.length, all.length - 1)
})

test('a committed approval needs no local decision', () => {
  const all = fullSet('x', { approved: true })
  assert.equal(playableSongs(all, {}).length, 5)
  assert.equal(awaitingReview(all, {}), 0, 'already judged is not pending')
})

test('a song with no clip is never playable and never pending', () => {
  const all = [...fullSet('x', { approved: true }), { ...song('noclip', 'easy'), previewUrl: undefined }]
  assert.ok(!playableSongs(all, {}).some((s) => s.id === 'noclip'))
  assert.equal(awaitingReview(all, {}), 0, 'there is nothing to listen to')
})

test('a brand new catalogue plays nothing at all', () => {
  // This is the case the old bootstrap got wrong: it let a whole unheard
  // catalogue through precisely because none of it had been approved yet.
  const fresh = fullSet('spacetoon')
  assert.deepEqual(playableSongs(fresh, {}), [])
  assert.equal(awaitingReview(fresh, {}), 5)
})
