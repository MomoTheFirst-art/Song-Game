import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  difficultyFor, slugify, toSong, dedupe, findArtist, harvestArtist, run, parseArgs, DEFAULTS,
} from './harvest.mjs'
import { DAILY_ORDER } from '../src/game/daily.ts'

const track = (id, title, artist, preview = `https://cdns-preview/${id}.mp3`, extra = {}) => ({
  id, title, title_short: title, preview, rank: 500000,
  artist: { id: 9, name: artist }, album: { id: 7, title: `${title} - Single`, cover_medium: 'https://c/x.jpg' },
  ...extra,
})
const ok = (data) => ({ ok: true, json: async () => ({ data }) })

test('popularity order becomes the difficulty ramp', () => {
  const tiers = Array.from({ length: 25 }, (_, i) => difficultyFor(i, 25))
  assert.equal(tiers[0], 'easy', 'the most played song is the easy one')
  assert.equal(tiers.at(-1), 'impossible', 'the least played is the hardest')
  assert.deepEqual([...new Set(tiers)], DAILY_ORDER, 'every tier gets filled, in order')
  assert.equal(difficultyFor(0, 1), 'easy', 'a lone track does not land in impossible')
  assert.equal(difficultyFor(0, 0), 'easy')
})

test('ids are readable, bounded, and never empty', () => {
  assert.equal(slugify('Tamally Maak', 1), 'tamally-maak')
  assert.equal(slugify('N.Y. State of Mind!', 2), 'n-y-state-of-mind')
  assert.equal(slugify('تملي معاك', 42), 'dz-42', 'a title with no Latin falls back to the track id')
  assert.ok(slugify('x'.repeat(200), 3).length <= 48)
})

test('a harvested song arrives with no clip and no verdict', () => {
  // Two gates, and bulk collection is exactly where both get bypassed. The
  // clip is absent on purpose: Deezer signs its previews with a ~12 minute
  // expiry, so storing one puts audio in the catalogue that is dead before
  // anyone can review it.
  const s = toSong(track(1, 'Lose Yourself', 'Eminem'), { difficulty: 'easy' })
  assert.equal(s.previewUrl, undefined, 'an expiring URL must never be stored')
  assert.equal(s.artwork, undefined)
  assert.equal(s.approved, undefined)
  assert.equal(s.startAt, 0)
  assert.equal(s.harvestedFrom, 'deezer', 'where it came from is recorded')
})

test('a harvest never re-adds a song the catalogue already has', () => {
  const existing = [{ id: 'old', title: 'Juicy', artist: 'The Notorious B.I.G.' }]
  const candidates = [
    toSong(track(2, 'Juicy', 'The Notorious B.I.G.'), { difficulty: 'easy' }),
    toSong(track(3, 'Big Poppa', 'The Notorious B.I.G.'), { difficulty: 'easy' }),
  ]
  const { kept, skipped } = dedupe(candidates, existing)
  assert.deepEqual(kept.map((s) => s.title), ['Big Poppa'])
  assert.deepEqual(skipped.map((s) => s.why), ['already have this title by this artist'])
})

test('a clashing id is suffixed, and only by a song actually kept', () => {
  const existing = [
    { id: 'alright', title: 'Other', artist: 'Someone' },
    { id: 'alright-2', title: 'Alright', artist: 'Someone Else' },
  ]
  const candidates = [
    toSong(track(1, 'Alright', 'Someone Else'), { difficulty: 'easy' }), // dropped: same title+artist
    toSong(track(2, 'Alright', 'Kendrick Lamar'), { difficulty: 'easy' }),
  ]
  const { kept } = dedupe(candidates, existing)
  assert.deepEqual(kept.map((s) => s.id), ['alright-3'], 'the dropped one must not burn a suffix')
})


test('an exact name beats a more-followed near match', () => {
  const fetchImpl = async () => ok([
    { id: 1, name: 'Fairuz Tribute Band', nb_fan: 900000 },
    { id: 2, name: 'Fairuz', nb_fan: 100 },
  ])
  return findArtist('Fairuz', fetchImpl).then((a) => assert.equal(a.id, 2))
})

test('with no exact name, the most-followed wins', async () => {
  const fetchImpl = async () => ok([
    { id: 1, name: 'Amr Diab Official', nb_fan: 10 },
    { id: 2, name: 'Amr Diab Live', nb_fan: 5000 },
  ])
  assert.equal((await findArtist('Amr Diab', fetchImpl)).id, 2)
})

test('Deezer errors arrive as HTTP 200 and still stop the harvest', async () => {
  const fetchImpl = async () => ({ ok: true, json: async () => ({ error: { message: 'Quota limit exceeded' } }) })
  await assert.rejects(() => findArtist('x', fetchImpl), /Quota limit exceeded/)
})

test('one unreachable artist does not sink the run', async () => {
  let written = null
  const lines = []
  const res = await run(
    { ...DEFAULTS, delay: 0, artists: ['Bad', 'Good'] },
    {
      fetch: async (url) => {
        if (url.includes('search/artist')) {
          if (url.includes('Bad')) throw new Error('ENOTFOUND')
          return ok([{ id: 2, name: 'Good', nb_fan: 1 }])
        }
        return ok([track(1, 'A Song', 'Good')])
      },
      log: (l) => lines.push(l),
      readCatalogue: async () => [],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(res.added, 1)
  assert.equal(res.failures.length, 1)
  assert.equal(written.length, 1)
  assert.ok(lines.some((l) => l.includes('✗ Bad')))
})

test('--dry-run writes nothing', async () => {
  let written = null
  const res = await run(
    { ...DEFAULTS, delay: 0, dryRun: true, artists: ['Good'] },
    {
      fetch: async (url) => url.includes('search/artist')
        ? ok([{ id: 2, name: 'Good', nb_fan: 1 }])
        : ok([track(1, 'A Song', 'Good')]),
      log: () => {},
      readCatalogue: async () => [],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(res.added, 1, 'it still reports what it would add')
  assert.equal(written, null)
})

test('the same artist named twice is harvested once', () => {
  const opts = parseArgs(['--artist', 'Nas', '--artist', 'Nas', '--limit', '5'])
  assert.deepEqual(opts.artists, ['Nas', 'Nas'])
  assert.equal(opts.limit, 5)
})
