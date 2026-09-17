/**
 * No song may appear twice in a single sitting — in solo, or across a whole
 * party. A repeated clip is a free point for whoever heard it first, and in
 * solo it reads as a bug.
 *
 * The other suites prove this on synthetic catalogues, which is where the
 * logic lives but not where it ships. These run against the real catalogue at
 * the real approved pool, because the guarantee depends on the shape of the
 * data as much as on the code: it holds because a song sits in exactly one
 * difficulty tier and each tier is drawn from without replacement.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dealSongs, maxPlayersFor, PARTY_TIERS, SONGS_PER_PLAYER, MIN_PLAYERS } from '../src/game/party.ts'
import { dailySongs, practiceSongs, todayKey } from '../src/game/daily.ts'

const all = JSON.parse(readFileSync(new URL('../src/data/songs.json', import.meta.url), 'utf8'))
const playable = all.filter((s) => s.previewUrl && s.approved !== false)
const approved = all.filter((s) => s.previewUrl && s.approved === true)

const ids = (songs) => songs.map((s) => s.id)
const allDistinct = (songs) => new Set(ids(songs)).size === songs.length

test('every song sits in exactly one difficulty tier', () => {
  // The whole no-duplicate guarantee rests on this: both modes draw one song
  // per tier, so a song belonging to two tiers could be drawn twice.
  for (const s of all) {
    assert.equal(typeof s.difficulty, 'string', `${s.id} has no difficulty`)
  }
  assert.equal(new Set(all.map((s) => s.id)).size, all.length, 'catalogue ids are unique')
})

test('no two catalogue entries share a preview clip', () => {
  // Two songs on one recording is the mismatch that handed كده يا قلبي the
  // clip for صبري قليل. It also duplicates audio in play: a player can hear
  // the same thirty seconds under two different answers.
  const seen = new Map()
  for (const s of all.filter((x) => x.previewUrl)) {
    const other = seen.get(s.previewUrl)
    assert.equal(other, undefined, `${s.id} and ${other} share one clip`)
    seen.set(s.previewUrl, s.id)
  }
})

test('a solo run never repeats a song', () => {
  for (let i = 0; i < 200; i++) {
    assert.ok(allDistinct(practiceSongs(playable)), 'practice run repeated a song')
  }
  // Daily is seeded, so sweep a year of keys rather than trusting one draw.
  const start = Date.parse('2026-01-01T00:00:00Z')
  for (let d = 0; d < 365; d++) {
    const key = todayKey(new Date(start + d * 86400000))
    assert.ok(allDistinct(dailySongs(playable, key)), `daily ${key} repeated a song`)
  }
})

test('a party never deals one song to two players', () => {
  const ceiling = maxPlayersFor(approved)
  assert.ok(ceiling >= MIN_PLAYERS, `the approved pool supports only ${ceiling} players`)

  for (let count = MIN_PLAYERS; count <= ceiling; count++) {
    for (let trial = 0; trial < 100; trial++) {
      const hands = dealSongs(approved, count)
      const dealt = hands.flat()
      assert.ok(allDistinct(dealt), `${count} players, trial ${trial}: a song was dealt twice`)
      for (const hand of hands) {
        assert.equal(hand.length, SONGS_PER_PLAYER, `${count} players: a hand was short`)
        assert.deepEqual(hand.map((s) => s.difficulty), [...PARTY_TIERS], 'hand is off-shape')
      }
    }
  }
})

test('the advertised capacity is one every tier can actually fill', () => {
  // maxPlayersFor is what the setup screen caps the counter at. If it ever
  // exceeds what a tier holds, the last players silently get short hands
  // instead of a repeated song — the same bug wearing a different face.
  const ceiling = maxPlayersFor(approved)
  for (const tier of PARTY_TIERS) {
    const held = approved.filter((s) => s.difficulty === tier).length
    assert.ok(held >= ceiling, `${tier} holds ${held} songs but ${ceiling} players are allowed`)
  }
})
