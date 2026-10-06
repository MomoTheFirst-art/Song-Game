import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_START, clampStart, withStarts } from '../src/game/starts.ts'
import { STAGES } from '../src/game/stages.ts'

const song = (id, startAt) => ({ id, title: id, artist: 'x', difficulty: 'easy', startAt })

test('the longest stage still fits inside a 30 second preview', () => {
  assert.equal(MAX_START + STAGES[STAGES.length - 1], 30)
})

test('starts are clamped into range and snapped to half seconds', () => {
  assert.equal(clampStart(-4), 0)
  assert.equal(clampStart(99), MAX_START)
  assert.equal(clampStart(7.26), 7.5)
  assert.equal(clampStart(7.1), 7)
})

test('an override replaces the shipped start, and only for that song', () => {
  const [a, b] = withStarts([song('a', 0), song('b', 0)], { a: 8.5 })
  assert.equal(a.startAt, 8.5)
  assert.equal(b.startAt, 0)
})

test('a stored value out of range is clamped rather than trusted', () => {
  const [a] = withStarts([song('a', 0)], { a: 28 })
  assert.equal(a.startAt, MAX_START)
})
