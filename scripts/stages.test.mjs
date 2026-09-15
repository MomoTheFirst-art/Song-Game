import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STAGES, STAGE_POINTS, MAX_STAGE, secondsNoun, stageLabel } from '../src/game/stages.ts'

/** An Apple preview is 30 seconds; no clip may run past it. */
const PREVIEW_SECONDS = 30

test('stage lengths are the agreed 1/3/5/10/15', () => {
  assert.deepEqual([...STAGES], [1, 3, 5, 10, 15])
})

test('clips get longer, never shorter', () => {
  for (let i = 1; i < STAGES.length; i++) {
    assert.ok(STAGES[i] > STAGES[i - 1], `stage ${i} must exceed stage ${i - 1}`)
  }
})

test('every clip fits inside a 30-second preview', () => {
  for (const s of STAGES) assert.ok(s <= PREVIEW_SECONDS, `${s}s exceeds the preview length`)
})

test('points fall as the clue grows, one per stage', () => {
  assert.equal(STAGE_POINTS.length, STAGES.length)
  for (let i = 1; i < STAGE_POINTS.length; i++) {
    assert.ok(STAGE_POINTS[i] < STAGE_POINTS[i - 1], 'a longer clip must be worth less')
  }
  assert.equal(MAX_STAGE, STAGES.length - 1)
})

test('Arabic counts the noun correctly for every stage', () => {
  // 1 singular, 2 dual, 3-10 plural, 11+ singular again
  assert.equal(secondsNoun(1), 'ثانية')
  assert.equal(secondsNoun(2), 'ثانيتان')
  assert.equal(secondsNoun(3), 'ثوانٍ')
  assert.equal(secondsNoun(10), 'ثوانٍ')
  assert.equal(secondsNoun(11), 'ثانية')
  assert.equal(secondsNoun(15), 'ثانية')
})

test('stage labels read correctly end to end', () => {
  assert.equal(stageLabel(0), '1 ثانية')
  assert.equal(stageLabel(1), '3 ثوانٍ')
  assert.equal(stageLabel(2), '5 ثوانٍ')
  assert.equal(stageLabel(3), '10 ثوانٍ')
  assert.equal(stageLabel(4), '15 ثانية')
})
