import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verdictFor, canFieldRun, playableSongs, approvalsGovern } from '../src/game/review.ts'

const TIERS = ['easy', 'medium', 'hard', 'expert', 'impossible']
const song = (id, difficulty, extra = {}) => ({
  id, difficulty, previewUrl: `https://x/${id}.m4a`, ...extra,
})
/** One song in every tier, so a full run can be fielded. */
const fullSet = (prefix, extra = {}) => TIERS.map((t) => song(`${prefix}-${t}`, t, extra))

test('a local verdict overrides the committed one', () => {
  const s = song('a', 'easy', { approved: false })
  assert.equal(verdictFor(s, {}), 'rejected', 'committed rejection stands on its own')
  assert.equal(verdictFor(s, { a: 'approved' }), 'approved', 'local review wins')
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
  const out = playableSongs(all, { bad: 'rejected' })
  assert.ok(!out.some((s) => s.id === 'bad'), 'a rejected clip must never reach the game')
  assert.equal(out.length, all.length - 1)
})

test('unreviewed songs keep playing while approvals are too few', () => {
  const all = fullSet('a')
  const out = playableSongs(all, { 'a-easy': 'approved' })   // only one tier approved
  assert.equal(out.length, 5, 'the game must not empty out mid-review')
  assert.equal(approvalsGovern(all, { 'a-easy': 'approved' }), false)
})

test('once every tier is approved, only approved songs play', () => {
  const all = [...fullSet('good'), ...fullSet('unreviewed')]
  const decisions = Object.fromEntries(fullSet('good').map((s) => [s.id, 'approved']))
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
  assert.ok(!playableSongs(all, { noclip: 'approved' }).some((s) => s.id === 'noclip'))
})
