import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyAttempt, triesLeft } from '../src/game/round.ts'
import { MAX_STAGE, STAGES } from '../src/game/stages.ts'
import { roundScore } from '../src/game/scoring.ts'

const song = { id: 'a', title: 'ت', artist: 'ف', difficulty: 'easy', startAt: 0 }
const fresh = () => ({ song, stage: 0, attempts: [], status: 'playing' })
const wrong = (label = 'x') => ({ kind: 'wrong', target: 'song', label })

test('asking for more opens the next stretch of the clip', () => {
  let r = fresh()
  assert.equal(STAGES[r.stage], 1, 'a round starts on the shortest window')
  r = applyAttempt(r, { kind: 'skipped' })
  assert.equal(STAGES[r.stage], 3)
  assert.equal(r.status, 'playing', 'asking for more must not end the round')
  r = applyAttempt(r, wrong())
  assert.equal(STAGES[r.stage], 5, 'a wrong guess buys the same as the button')
})

test('the round is lost only once the last stretch is spent', () => {
  let r = fresh()
  for (let i = 0; i < MAX_STAGE; i++) r = applyAttempt(r, wrong(`g${i}`))
  assert.equal(r.stage, MAX_STAGE)
  assert.equal(r.status, 'playing', 'the final stretch still deserves a guess')
  r = applyAttempt(r, wrong('last'))
  assert.equal(r.status, 'lost')
  assert.equal(roundScore(r), 0)
})

test('every stretch is worth less than the one before it', () => {
  let r = fresh()
  const paid = [roundScore({ ...r, status: 'won' })]
  for (let i = 0; i < MAX_STAGE; i++) {
    r = applyAttempt(r, { kind: 'skipped' })
    paid.push(roundScore({ ...r, status: 'won' }))
  }
  assert.deepEqual(paid, [1200, 975, 750, 525, 300])
})

test('a finished round ignores further attempts', () => {
  const won = applyAttempt(fresh(), { kind: 'correct', target: 'song' })
  assert.equal(won.status, 'won')
  assert.equal(roundScore(won), 1200)
  assert.deepEqual(applyAttempt(won, wrong()), won)
})

test('tries left counts the stretch in hand, down to the last one', () => {
  let r = fresh()
  assert.equal(triesLeft(r), STAGES.length)
  for (let i = 0; i < MAX_STAGE; i++) r = applyAttempt(r, { kind: 'skipped' })
  assert.equal(triesLeft(r), 1, 'the last stretch must read as the last')
})
