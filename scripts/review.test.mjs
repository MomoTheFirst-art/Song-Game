import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verdictFor, canFieldRun, playableSongs, approvalsGovern } from '../src/game/review.ts'

const TIERS = ['easy', 'medium', 'hard', 'expert', 'impossible']
const song = (id, difficulty, extra = {}) => ({
  id, difficulty, previewUrl: `https://x/${id}.m4a`, ...extra,
})
/** One song in every tier, so a full run can be fielded. */
const fullSet = (prefix, extra = {}) => TIERS.map((t) => song(`${prefix}-${t}`, t, extra))
/** A verdict passed on the clip the song currently has. */
const on = (s, verdict) => ({ verdict, clip: s.previewUrl })

test('a local verdict overrides the committed one', () => {
  const s = song('a', 'easy', { approved: false })
  assert.equal(verdictFor(s, {}), 'rejected', 'committed rejection stands on its own')
  assert.equal(verdictFor(s, { a: on(s, 'approved') }), 'approved', 'local review wins')
})

test('an unreviewed song has no verdict', () => {
  assert.equal(verdictFor(song('a', 'easy'), {}), undefined)
})

test('a run can only be fielded with every tier represented', () => {
  assert.equal(canFieldRun(fullSet('x')), true)
  assert.equal(canFieldRun(fullSet('x').slice(0, 4)), false, 'one tier missing')
  assert.equal(canFieldRun([]), false)
})

test('rejected songs never play, even before approvals govern', () => {
  const all = [...fullSet('a'), song('bad', 'easy')]
  const out = playableSongs(all, { bad: on(all[all.length - 1], 'rejected') })
  assert.ok(!out.some((s) => s.id === 'bad'), 'a rejected clip must never reach the game')
  assert.equal(out.length, all.length - 1)
})

test('unreviewed songs keep playing while approvals are too few', () => {
  const all = fullSet('a')
  const one = { 'a-easy': on(all[0], 'approved') }   // only one tier approved
  const out = playableSongs(all, one)
  assert.equal(out.length, 5, 'the game must not empty out mid-review')
  assert.equal(approvalsGovern(all, one), false)
})

test('once every tier is approved, only approved songs play', () => {
  const all = [...fullSet('good'), ...fullSet('unreviewed')]
  const good = fullSet('good')
  const decisions = Object.fromEntries(good.map((s) => [s.id, on(s, 'approved')]))
  const out = playableSongs(all, decisions)
  assert.equal(out.length, 5)
  assert.ok(out.every((s) => s.id.startsWith('good-')), 'unreviewed songs step aside')
  assert.equal(approvalsGovern(all, decisions), true)
})

test('committed approvals work without any local review', () => {
  const all = fullSet('c', { approved: true })
  assert.equal(approvalsGovern(all, {}), true)
  assert.equal(playableSongs(all, {}).length, 5)
})

test('songs without a clip are never playable', () => {
  const all = [...fullSet('a'), { id: 'noclip', difficulty: 'easy' }]
  assert.ok(!playableSongs(all, {}).some((s) => s.id === 'noclip'))
  const claimed = { noclip: { verdict: 'approved', clip: 'https://x/ghost.m4a' } }
  assert.ok(!playableSongs(all, claimed).some((s) => s.id === 'noclip'))
})

test('a verdict does not survive the clip being replaced', () => {
  // A rejected song gets re-fetched and comes back with different audio. The
  // old verdict described audio that no longer exists, so it must not hide the
  // new clip from review — this is what left 18 re-fetched songs invisible.
  const before = song('x', 'easy')
  const decisions = { x: { verdict: 'rejected', clip: before.previewUrl } }
  assert.equal(verdictFor(before, decisions), 'rejected', 'still applies to the same clip')

  const after = { ...before, previewUrl: 'https://x/DIFFERENT.m4a' }
  assert.equal(verdictFor(after, decisions), undefined, 'new audio means unreviewed again')
})

test('a committed verdict still applies after a stale local one is voided', () => {
  const before = song('y', 'easy', { approved: true })
  const after = { ...before, previewUrl: 'https://x/NEW.m4a' }
  const decisions = { y: { verdict: 'rejected', clip: before.previewUrl } }
  assert.equal(verdictFor(after, decisions), 'approved', 'falls back to the catalogue')
})
