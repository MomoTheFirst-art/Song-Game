import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  difficultyFor, slugify, toSong, dedupe, findArtist, run, parseArgs, DEFAULTS,
} from './harvest.mjs'
import { DAILY_ORDER } from '../src/game/daily.ts'

const track = (id, title, artist, previewUrl = `https://audio-ssl.itunes.apple.com/${id}.m4a`, extra = {}) => ({
  wrapperType: 'track', trackId: id, trackName: title, artistName: artist,
  collectionName: `${title} - Single`, previewUrl, artworkUrl100: 'https://is1-ssl/x.jpg',
  releaseDate: '2003-05-26T07:00:00Z', ...extra,
})
const ok = (results) => ({ ok: true, status: 200, text: async () => JSON.stringify({ results }) })

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

test('a harvested song arrives unapproved', () => {
  // Bulk collection is exactly where an approval gate gets bypassed.
  const s = toSong(track(1, 'Lose Yourself', 'Eminem'), { difficulty: 'easy' })
  assert.equal(s.approved, undefined)
  assert.equal(s.startAt, 0)
  assert.equal(s.year, 2003, 'the release year carries over')
  assert.match(s.previewUrl, /audio-ssl\.itunes\.apple\.com/)
  assert.ok(!/exp=|hmac=/.test(s.previewUrl), 'a stored clip URL must not be signed or expiring')
  assert.equal(s.matchedAs.source, 'itunes-harvest')
})

test('artistIsTitle credits a cartoon opening to its show', () => {
  const s = toSong(track(1, 'عدنان ولينا', 'طارق العربي طرقان'), { difficulty: 'easy', artistIsTitle: true })
  assert.equal(s.artist, 'عدنان ولينا')
  assert.equal(s.artistLatin, 'عدنان ولينا')
  assert.equal(s.matchedAs.artist, 'طارق العربي طرقان', 'who actually recorded it is still recorded')
})

test('a harvest never re-adds a song the catalogue already has', () => {
  const existing = [{ id: 'old', title: 'Juicy', artist: 'The Notorious B.I.G.', previewUrl: 'https://p/j.m4a' }]
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
    { id: 'alright', title: 'Other', artist: 'Someone', previewUrl: 'https://p/o.m4a' },
    { id: 'alright-2', title: 'Alright', artist: 'Someone Else', previewUrl: 'https://p/b.m4a' },
  ]
  const candidates = [
    toSong(track(1, 'Alright', 'Someone Else'), { difficulty: 'easy' }), // dropped: same title+artist
    toSong(track(2, 'Alright', 'Kendrick Lamar'), { difficulty: 'easy' }),
  ]
  const { kept } = dedupe(candidates, existing)
  assert.deepEqual(kept.map((s) => s.id), ['alright-3'], 'the dropped one must not burn a suffix')
})


test('an exact name beats a tribute act listed above it', async () => {
  const fetchImpl = async () => ok([
    { artistId: 1, artistName: 'Fairuz Tribute Band' },
    { artistId: 2, artistName: 'Fairuz' },
  ])
  assert.equal((await findArtist('Fairuz', DEFAULTS, fetchImpl)).artistId, 2)
})

test('with no exact name, Apple’s own first result stands', async () => {
  const fetchImpl = async () => ok([
    { artistId: 1, artistName: 'Amr Diab Official' },
    { artistId: 2, artistName: 'Amr Diab Live' },
  ])
  assert.equal((await findArtist('Amr Diab', DEFAULTS, fetchImpl)).artistId, 1)
})

test('a throttled empty body is an error, not an empty discography', async () => {
  // Apple answers a throttled request with a blank body, which JSON.parse
  // turns into a crash and a naive reader turns into "this artist has no songs".
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '' })
  await assert.rejects(() => findArtist('x', DEFAULTS, fetchImpl), /throttled/)
})

test('one unreachable artist does not sink the run', async () => {
  let written = null
  const lines = []
  const res = await run(
    { ...DEFAULTS, delay: 0, artists: ['Bad', 'Good'] },
    {
      fetch: async (url) => {
        if (url.includes('/search?')) {
          if (url.includes('Bad')) throw new Error('ENOTFOUND')
          return ok([{ artistId: 2, artistName: 'Good' }])
        }
        return ok([{ wrapperType: 'artist' }, track(1, 'A Song', 'Good')])
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
      fetch: async (url) => url.includes('/search?')
        ? ok([{ artistId: 2, artistName: 'Good' }])
        : ok([{ wrapperType: 'artist' }, track(1, 'A Song', 'Good')]),
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
