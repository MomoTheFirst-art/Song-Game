/**
 * مبتدئ: the player commits to a target before guessing. Naming the artist
 * pays half the stage, naming the song pays it in full, and either ends the
 * round. The half is the whole point of the mode, so it is guarded here.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { roundScore, totalScore, ARTIST_SHARE } from '../src/game/scoring.ts'
import { STAGE_POINTS } from '../src/game/stages.ts'
import { searchArtists, normalize } from '../src/game/search.ts'

const catalogue = JSON.parse(readFileSync(new URL('../src/data/songs.json', import.meta.url), 'utf8'))
const song = catalogue[0]
const round = (over) => ({ song, stage: 0, attempts: [], status: 'won', ...over })

test('naming the song pays the stage in full', () => {
  assert.equal(roundScore(round({ solvedAs: 'song' })), STAGE_POINTS[0])
  assert.equal(roundScore(round({ stage: 3, solvedAs: 'song' })), STAGE_POINTS[3])
})

test('naming only the artist pays half', () => {
  assert.equal(roundScore(round({ solvedAs: 'artist' })), Math.round(STAGE_POINTS[0] * ARTIST_SHARE))
  assert.equal(roundScore(round({ stage: 3, solvedAs: 'artist' })), Math.round(STAGE_POINTS[3] * ARTIST_SHARE))
  assert.ok(
    roundScore(round({ solvedAs: 'artist' })) < roundScore(round({ solvedAs: 'song' })),
    'the cheaper answer must pay less at the same stage',
  )
})

test('a win without a recorded target scores in full', () => {
  // The other modes only ever ask for the song and set nothing, so an absent
  // value must not be read as the artist half.
  assert.equal(roundScore(round({})), STAGE_POINTS[0])
})

test('a lost round scores nothing however it was played', () => {
  assert.equal(roundScore(round({ status: 'lost', solvedAs: 'artist' })), 0)
  assert.equal(roundScore(round({ status: 'lost', solvedAs: 'song' })), 0)
})

test('a run mixing both kinds totals correctly', () => {
  const rounds = [
    round({ stage: 0, solvedAs: 'song' }),
    round({ stage: 0, solvedAs: 'artist' }),
    round({ stage: 2, status: 'lost' }),
  ]
  const expected = STAGE_POINTS[0] + Math.round(STAGE_POINTS[0] * ARTIST_SHARE)
  assert.equal(totalScore(rounds), expected)
})

test('the artist list offers each performer once', () => {
  // أصالة appears on several songs; the picker must not list it several times.
  const all = searchArtists(catalogue, '', 500)
  assert.equal(new Set(all.map(normalize)).size, all.length, 'a performer was offered twice')
  assert.ok(all.length > 20, `expected many artists, saw ${all.length}`)
})

test('the artist search matches Arabic and Latin, and spelling variants', () => {
  const byArabic = searchArtists(catalogue, 'عمرو')
  assert.ok(byArabic.some((a) => a.includes('عمرو')), 'Arabic query found nothing')
  const byLatin = searchArtists(catalogue, 'amr')
  assert.ok(byLatin.length > 0, 'Latin query found nothing')
  // Folding is what makes a typed أ match a stored ا.
  assert.ok(searchArtists(catalogue, 'اصاله').length > 0, 'unfolded spelling found nothing')
})

test('an artist guess is compared on the folded form', () => {
  // How App matches a pick against the answer: the catalogue spells the same
  // performer more than one way, so raw equality would reject a correct pick.
  assert.equal(normalize('أصالة'), normalize('اصاله'))
  assert.notEqual(normalize('أصالة'), normalize('شيرين'))
})

test('every song has an artist the picker can offer', () => {
  // A song whose artist is missing or blank would be unanswerable in this mode.
  for (const s of catalogue) {
    assert.ok(normalize(s.artist).length > 0, `${s.id} has no usable artist`)
  }
})
