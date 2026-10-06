import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STAGES, STAGE_POINTS, MAX_STAGE, MAX_ATTEMPTS, tierAfter, secondsNoun } from '../src/game/stages.ts'

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


/**
 * The clip bar draws each stage proportional to the seconds it adds, so these
 * spans are what makes the bar an honest picture of the clip rather than five
 * equal boxes.
 */
test('stage spans are the gaps between stages and fill the clip exactly', () => {
  const spans = STAGES.map((s, i) => s - (STAGES[i - 1] ?? 0))
  assert.deepEqual(spans, [1, 2, 2, 5, 5])
  assert.equal(
    spans.reduce((a, b) => a + b, 0),
    STAGES[STAGES.length - 1],
    'spans must add up to the full clip length',
  )
  assert.ok(spans.every((s) => s > 0), 'a stage that adds no time would be invisible')
})

/**
 * The clip plays straight through, so time is what spends the points. These
 * are the boundaries a correct answer is priced at.
 */
test('the tier falls as the clip plays, and floors at the last one', () => {
  assert.equal(tierAfter(0), 0, 'nothing heard yet is still worth full marks')
  assert.equal(tierAfter(0.9), 0)
  assert.equal(tierAfter(1), 1, 'the first second is spent the moment it is up')
  assert.equal(tierAfter(2.9), 1)
  assert.equal(tierAfter(3), 2)
  assert.equal(tierAfter(5), 3)
  assert.equal(tierAfter(10), 4)
  assert.equal(tierAfter(15), MAX_STAGE, 'the clip ending must not drop past the floor')
  assert.equal(tierAfter(999), MAX_STAGE)
})

test('every tier the clock can reach is worth less than the one before', () => {
  const reached = STAGES.map((s) => tierAfter(s))
  const points = reached.map((t) => STAGE_POINTS[t])
  for (let i = 1; i < points.length; i++) {
    assert.ok(points[i] <= points[i - 1], `tier ${i} must not pay more than tier ${i - 1}`)
  }
  assert.equal(STAGE_POINTS[tierAfter(0)], 1200)
})
