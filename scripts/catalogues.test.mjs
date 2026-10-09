import { test } from 'node:test'
import assert from 'node:assert/strict'
import { GENRES, everySong, genreById, DEFAULT_GENRE } from '../src/game/catalogues.ts'
import { DAILY_ORDER } from '../src/game/daily.ts'

test('every catalogue has songs and a distinct id', () => {
  const ids = GENRES.map((g) => g.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const g of GENRES) assert.ok(g.all.length > 0, `${g.id} is empty`)
  assert.ok(ids.includes(DEFAULT_GENRE))
})

test('no song id is reused across catalogues', () => {
  // Review verdicts and start points are keyed by id alone, so a collision
  // would silently apply one catalogue's decision to another's song.
  const ids = everySong.map((s) => s.id)
  const seen = new Set()
  const dupes = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)))
  assert.deepEqual(dupes, [])
})

test('every catalogue can field a full run', () => {
  for (const g of GENRES) {
    for (const tier of DAILY_ORDER) {
      assert.ok(
        g.all.some((s) => s.difficulty === tier),
        `${g.id} has nothing at ${tier}, so its daily would run short`,
      )
    }
  }
})

test('every song carries what the game and the lookup both need', () => {
  for (const s of everySong) {
    for (const field of ['id', 'title', 'titleLatin', 'artist', 'artistLatin']) {
      assert.ok(s[field], `${s.id} is missing ${field}`)
    }
    assert.equal(typeof s.year, 'number', `${s.id} has no year`)
    assert.equal(typeof s.startAt, 'number', `${s.id} has no startAt`)
  }
})

test('an unknown genre falls back rather than crashing', () => {
  assert.equal(genreById('nope'), GENRES[0])
})
