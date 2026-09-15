import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  dealSongs, createPlayers, playerScore, standings, maxPlayersFor,
  PARTY_TIERS, SONGS_PER_PLAYER, MAX_PLAYERS, partyComplete,
} from '../src/game/party.ts'

const catalogue = JSON.parse(readFileSync(new URL('../src/data/songs.json', import.meta.url), 'utf8'))
  .filter((s) => s.previewUrl)

const player = (name, results) => ({ id: 0, name, songs: [1, 2, 3], results })

test('each player is dealt one song per tier, in order', () => {
  const hands = dealSongs(catalogue, 4)
  assert.equal(hands.length, 4)
  for (const hand of hands) {
    assert.equal(hand.length, SONGS_PER_PLAYER)
    assert.deepEqual(hand.map((s) => s.difficulty), [...PARTY_TIERS])
  }
})

test('no song is dealt to two players', () => {
  for (let trial = 0; trial < 20; trial++) {
    const hands = dealSongs(catalogue, 6)
    const ids = hands.flat().map((s) => s.id)
    assert.equal(new Set(ids).size, ids.length, 'a repeated clip would be a free point')
  }
})

test('deals vary between games', () => {
  const seen = new Set(
    Array.from({ length: 20 }, () => dealSongs(catalogue, 3).flat().map((s) => s.id).join(',')),
  )
  assert.ok(seen.size > 15, `expected varied deals, saw ${seen.size}`)
})

test('the catalogue caps the player count honestly', () => {
  const cap = maxPlayersFor(catalogue)
  assert.ok(cap >= 2 && cap <= MAX_PLAYERS)
  // a tier with only two songs must cap the party at two players
  const thin = catalogue.filter((s) => s.difficulty !== 'easy')
    .concat(catalogue.filter((s) => s.difficulty === 'easy').slice(0, 2))
  assert.equal(maxPlayersFor(thin), 2)
  assert.equal(maxPlayersFor([]), 0)
})

test('a blank name falls back to a numbered label', () => {
  const players = createPlayers(['رامي', '   ', ''], catalogue)
  assert.equal(players[0].name, 'رامي')
  assert.equal(players[1].name, 'لاعب 2')
  assert.equal(players[2].name, 'لاعب 3')
})

test('score sums the stage each song was solved at', () => {
  assert.equal(playerScore(player('a', [0, 0, 0])), 3600)   // 1200 x3
  assert.equal(playerScore(player('a', [4, 4, 4])), 900)    // 300 x3
  assert.equal(playerScore(player('a', [0, null, 2])), 1200 + 750)
  assert.equal(playerScore(player('a', [null, null, null])), 0)
  assert.equal(playerScore(player('a', [])), 0)
})

test('standings rank by score, highest first', () => {
  const rows = standings([
    player('Low', [4, null, null]),      // 300
    player('High', [0, 0, null]),        // 2400
    player('Mid', [2, null, null]),      // 750
  ])
  assert.deepEqual(rows.map((r) => r.player.name), ['High', 'Mid', 'Low'])
  assert.deepEqual(rows.map((r) => r.rank), [1, 2, 3])
  assert.deepEqual(rows.map((r) => r.isWinner), [true, false, false])
})

test('a draw produces joint winners rather than an arbitrary tiebreak', () => {
  const rows = standings([
    player('A', [1, null, null]),   // 975
    player('B', [1, null, null]),   // 975
    player('C', [4, null, null]),   // 300
  ])
  assert.equal(rows.filter((r) => r.isWinner).length, 2)
  assert.deepEqual(rows.map((r) => r.rank), [1, 1, 3], 'tied players share a rank, the next is skipped')
})

test('nobody wins when nobody scored', () => {
  const rows = standings([player('A', [null]), player('B', [null])])
  assert.equal(rows.filter((r) => r.isWinner).length, 0)
})

test('a party is complete only when every player has finished', () => {
  const a = { id: 0, name: 'a', songs: [1, 2, 3], results: [0, 1, 2] }
  const b = { id: 1, name: 'b', songs: [1, 2, 3], results: [0, 1] }
  assert.equal(partyComplete([a, a]), true)
  assert.equal(partyComplete([a, b]), false)
})
