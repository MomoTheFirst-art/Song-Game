import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAttempt, applyListened } from '../src/game/round.ts'
import { MAX_ATTEMPTS, STAGES } from '../src/game/stages.ts'
import { roundScore } from '../src/game/scoring.ts'

const song = { id: 'a', title: 'ت', artist: 'ف', difficulty: 'easy', startAt: 0 }
const fresh = () => ({ song, stage: 0, attempts: [], status: 'playing' })
const wrong = (label = 'x') => ({ kind: 'wrong', target: 'song', label })

test('a wrong guess costs an attempt but never a tier', () => {
  let r = fresh()
  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) r = applyAttempt(r, wrong())
  assert.equal(r.stage, 0, 'guessing must not move the tier — only the clock does')
  assert.equal(r.status, 'playing')
  assert.equal(roundScore({ ...r, status: 'won' }), 1200, 'still worth full marks')
})

test('the round is lost on the last allowed wrong guess', () => {
  let r = fresh()
  for (let i = 0; i < MAX_ATTEMPTS; i++) r = applyAttempt(r, wrong())
  assert.equal(r.status, 'lost')
  assert.equal(r.attempts.length, MAX_ATTEMPTS)
  assert.equal(roundScore(r), 0)
})

test('giving up ends the round there and then', () => {
  const r = applyAttempt(fresh(), { kind: 'skipped' })
  assert.equal(r.status, 'lost')
  assert.equal(r.attempts.length, 1, 'surrender must not need five presses')
})

test('a finished round ignores further attempts', () => {
  const won = applyAttempt(fresh(), { kind: 'correct', target: 'song' })
  assert.equal(won.status, 'won')
  assert.deepEqual(applyAttempt(won, wrong()), won)
  assert.deepEqual(applyListened(won, 15), won, 'the clock must not re-price a finished round')
})

test('the clip playing on is what spends the points', () => {
  let r = fresh()
  assert.equal(roundScore({ ...r, status: 'won' }), 1200)
  r = applyListened(r, 1)
  assert.equal(roundScore({ ...r, status: 'won' }), 975)
  r = applyListened(r, 5)
  assert.equal(roundScore({ ...r, status: 'won' }), 525)
  r = applyListened(r, STAGES[STAGES.length - 1])
  assert.equal(roundScore({ ...r, status: 'won' }), 300, 'the floor is the last tier')
})

test('replaying cannot buy a tier back', () => {
  let r = applyListened(fresh(), 10)
  const spent = r.stage
  r = applyListened(r, 1)
  assert.equal(r.stage, spent, 'already heard is already paid for')
})

test('a round can be won at full marks after four wrong guesses if nothing played', () => {
  let r = fresh()
  for (let i = 0; i < MAX_ATTEMPTS - 1; i++) r = applyAttempt(r, wrong(`g${i}`))
  r = applyAttempt(r, { kind: 'correct', target: 'song' })
  assert.equal(r.status, 'won')
  assert.equal(roundScore(r), 1200)
})
