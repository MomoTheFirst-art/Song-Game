import { test } from 'node:test'
import assert from 'node:assert/strict'
import { wrongGuesses } from '../src/game/types.ts'

test('only wrong guesses are listed, oldest first', () => {
  assert.deepEqual(
    wrongGuesses([
      { kind: 'wrong', target: 'song', label: 'كده يا قلبي' },
      { kind: 'skipped' },
      { kind: 'wrong', target: 'artist', label: 'أصالة' },
      { kind: 'correct', target: 'song' },
    ]),
    ['كده يا قلبي', 'أصالة'],
  )
})

test('a round with nothing guessed yet shows nothing', () => {
  assert.deepEqual(wrongGuesses([]), [])
  assert.deepEqual(wrongGuesses([{ kind: 'skipped' }]), [])
})
