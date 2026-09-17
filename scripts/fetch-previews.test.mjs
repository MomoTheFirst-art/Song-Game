import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  similarity, scoreCandidate, pickBest, buildQueries, searchUrl, lookup, parseArgs, run, DEFAULTS,
  MIN_ARTIST_SIMILARITY,
} from './fetch-previews.mjs'

const song = {
  id: 'tamally-maak',
  title: 'تملي معاك', titleLatin: 'Tamally Maak',
  artist: 'عمرو دياب', artistLatin: 'Amr Diab',
  difficulty: 'easy', startAt: 0,
}

const hit = {
  trackName: 'Tamally Maak', artistName: 'Amr Diab',
  previewUrl: 'https://audio-ssl.itunes.apple.com/preview/tamally.m4a',
  artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/x/100x100bb.jpg',
}
const wrong = { trackName: 'Completely Different', artistName: 'Someone Else', previewUrl: 'https://x/y.m4a' }
const noPreview = { trackName: 'Tamally Maak', artistName: 'Amr Diab', previewUrl: null }

const ok = (results) => ({ ok: true, status: 200, json: async () => ({ resultCount: results.length, results }) })

test('similarity folds Arabic spelling variants', () => {
  assert.equal(similarity('أهواك', 'اهواك'), 1)
  assert.equal(similarity('الليلة', 'الليله'), 1)
  assert.equal(similarity('تَمَلّي معاك', 'تملي معاك'), 1)
  assert.equal(similarity('Tamally Maak', 'tamally maak'), 1)
})

test('similarity handles containment and partial overlap', () => {
  assert.equal(similarity('Tamally Maak', 'Tamally Maak (Remastered)'), 0.85)
  assert.ok(similarity('Nour El Ein', 'Nour El Ain Habibi') > 0.3)
  assert.equal(similarity('Tamally Maak', 'Zay El Hawa'), 0)
  assert.equal(similarity('', 'anything'), 0)
})

test('a candidate without a previewUrl scores zero', () => {
  assert.equal(scoreCandidate(song, noPreview).score, 0)
  assert.ok(scoreCandidate(song, hit).score > 0.9)
})

test('the right title by the wrong artist is refused', () => {
  // The real failure seen in production: "ألف ليلة وليلة" names recordings by
  // several artists, and a perfect title alone carries 0.65 — over the bar.
  const impostor = {
    trackName: 'Tamally Maak',          // exactly right
    artistName: 'Some Other Performer', // completely wrong
    previewUrl: 'https://x/y.m4a',
  }
  const parts = scoreCandidate(song, impostor)
  assert.ok(parts.title > 0.9, 'title matches perfectly')
  assert.ok(parts.artist < MIN_ARTIST_SIMILARITY, 'artist does not')
  assert.ok(parts.score > 0.55, 'and the combined score would have passed the old bar')
  assert.equal(pickBest(song, [impostor], 0.55).match, null, 'but the artist floor rejects it')
})

test('a weaker match by the real artist beats a perfect title by the wrong one', () => {
  const impostor = { trackName: 'Tamally Maak', artistName: 'Nobody At All', previewUrl: 'https://x/1.m4a' }
  const genuine = { trackName: 'Tamally Maak (Remastered)', artistName: 'Amr Diab', previewUrl: 'https://x/2.m4a' }
  assert.equal(pickBest(song, [impostor, genuine], 0.55).match, genuine)
})

test('a preview another song already holds is refused', () => {
  // Production failure: كده يا قلبي cleared the artist floor (both Sherine)
  // and squeaked over the title bar at 0.57, so it was handed the clip that
  // already belonged to صبري قليل. Two entries sharing one recording is a
  // mismatch by definition, whatever the score says.
  const taken = new Set([hit.previewUrl])
  assert.equal(pickBest(song, [hit], 0.55, taken).match, null)

  // The next-best candidate still wins if its audio is free.
  const alternate = { ...hit, previewUrl: 'https://x/free.m4a' }
  assert.equal(pickBest(song, [hit, alternate], 0.55, taken).match, alternate)
})

test('lookup passes the claimed set through to every query', async () => {
  const taken = new Set([hit.previewUrl])
  const res = await lookup(song, { ...DEFAULTS, delay: 0 }, async () => ok([hit]), taken)
  assert.equal(res.match, null, 'the only candidate is spoken for')
})

test('run does not hand two songs the same preview', async () => {
  // Both entries resolve to the identical Apple result; only the first may keep it.
  const catalogue = [
    { id: 'a', title: 'صبري قليل', titleLatin: 'Sabry Aalil', artist: 'شيرين', artistLatin: 'Sherine', difficulty: 'easy', startAt: 0 },
    { id: 'b', title: 'كده يا قلبي', titleLatin: 'Keda Ya Alby', artist: 'شيرين', artistLatin: 'Sherine', difficulty: 'easy', startAt: 0 },
  ]
  const shared = {
    trackName: 'Sabry Aalil', artistName: 'Sherine',
    previewUrl: 'https://audio-ssl.itunes.apple.com/preview/sabry.m4a',
  }
  let written
  await run({ ...DEFAULTS, delay: 0 }, {
    fetch: async () => ok([shared]),
    log: () => {},
    readCatalogue: async () => catalogue,
    writeCatalogue: async (songs) => { written = songs },
  })
  assert.equal(written[0].previewUrl, shared.previewUrl, 'the better match keeps it')
  assert.equal(written[1].previewUrl, undefined, 'the other is left without a clip')
})

test('a forced re-fetch is not blocked by the song\'s own current preview', async () => {
  // Targets release their URLs into the pool before the run starts, or --force
  // could never return the same clip to the song that already had it.
  const catalogue = [{
    id: 'a', title: 'تملي معاك', titleLatin: 'Tamally Maak',
    artist: 'عمرو دياب', artistLatin: 'Amr Diab', difficulty: 'easy', startAt: 0,
    previewUrl: hit.previewUrl,
  }]
  let written
  await run({ ...DEFAULTS, delay: 0, force: true }, {
    fetch: async () => ok([hit]),
    log: () => {},
    readCatalogue: async () => catalogue,
    writeCatalogue: async (songs) => { written = songs },
  })
  assert.equal(written[0].previewUrl, hit.previewUrl)
})

test('pickBest honours the threshold', () => {
  assert.equal(pickBest(song, [wrong], 0.55).match, null)
  assert.equal(pickBest(song, [wrong, hit], 0.55).match, hit)
  assert.equal(pickBest(song, [], 0.55).match, null)
  // a real but imperfect match is rejected when the bar is raised
  assert.equal(pickBest(song, [{ ...hit, trackName: 'Tamally', artistName: 'Various' }], 0.95).match, null)
})

test('queries try Latin first, then Arabic', () => {
  const q = buildQueries(song)
  assert.equal(q[0], 'Amr Diab Tamally Maak')
  assert.equal(q[1], 'عمرو دياب تملي معاك')
})

test('searchUrl sets the documented parameters', () => {
  const u = new URL(searchUrl('Amr Diab', { limit: 10, country: 'SA' }))
  assert.equal(u.origin + u.pathname, 'https://itunes.apple.com/search')
  assert.equal(u.searchParams.get('media'), 'music')
  assert.equal(u.searchParams.get('entity'), 'song')
  assert.equal(u.searchParams.get('limit'), '10')
  assert.equal(u.searchParams.get('country'), 'SA')
  assert.equal(u.searchParams.get('term'), 'Amr Diab')
})

test('lookup falls through to the Arabic query when Latin misses', async () => {
  const calls = []
  const fake = async (url) => {
    calls.push(new URL(url).searchParams.get('term'))
    return calls.length === 1 ? ok([wrong]) : ok([hit])
  }
  const r = await lookup(song, { ...DEFAULTS, delay: 0 }, fake)
  assert.equal(r.match, hit)
  assert.equal(calls.length, 2)
  assert.equal(calls[1], 'عمرو دياب تملي معاك')
})

test('lookup reports rate limiting distinctly', async () => {
  const r = await lookup(song, { ...DEFAULTS, delay: 0 }, async () => ({ ok: false, status: 403 }))
  assert.match(r.error, /rate limited/)
  assert.equal(r.match, null)
})

test('lookup survives a network failure', async () => {
  const r = await lookup(song, { ...DEFAULTS, delay: 0 }, async () => { throw new Error('ENOTFOUND') })
  assert.match(r.error, /network: ENOTFOUND/)
})

test('parseArgs reads flags and rejects nonsense', () => {
  const o = parseArgs(['--country', 'EG', '--delay', '0', '--dry-run', '--only', 'ahwak'])
  assert.equal(o.country, 'EG')
  assert.equal(o.delay, 0)
  assert.equal(o.dryRun, true)
  assert.equal(o.only, 'ahwak')
  assert.equal(o.out, o.in, 'out defaults to in')
  assert.throws(() => parseArgs(['--nope']), /unknown option/)
})

test('run writes previewUrl and resets startAt to the top of the preview', async () => {
  let written = null
  const res = await run(
    { ...DEFAULTS, delay: 0, dryRun: false },
    {
      fetch: async () => ok([hit]),
      log: () => {},
      readCatalogue: async () => [{ ...song }],
      writeCatalogue: async (songs) => { written = songs },
    },
  )
  assert.equal(res.matched, 1)
  assert.equal(res.missed, 0)
  assert.ok(written, 'catalogue was written')
  assert.equal(written[0].previewUrl, hit.previewUrl)
  assert.equal(written[0].startAt, 0, 'preview clips start at the top')
  assert.equal(written[0].artwork, hit.artworkUrl100)
  assert.equal(written[0].id, 'tamally-maak', 'existing fields are preserved')
})

test('a same-artist, wrong-title result is refused, not attached', async () => {
  // The danger with a fuzzy match: Apple returns another track by the right
  // artist. Artist alone (0.35) must not clear the bar.
  let written = null
  const other = { ...song, id: 'nour-el-ein', title: 'نور العين', titleLatin: 'Nour El Ein' }
  const res = await run(
    { ...DEFAULTS, delay: 0 },
    {
      fetch: async () => ok([hit]),          // always the Tamally Maak result
      log: () => {},
      readCatalogue: async () => [{ ...other }],
      writeCatalogue: async (songs) => { written = songs },
    },
  )
  assert.equal(res.matched, 0, 'right artist, wrong song must not match')
  assert.equal(res.missed, 1)
  assert.equal(written, null)
})

test('run skips songs that already have a preview unless forced', async () => {
  const withPreview = [{ ...song, previewUrl: 'https://existing/x.m4a' }]
  let calls = 0
  const deps = {
    fetch: async () => { calls++; return ok([hit]) },
    log: () => {},
    readCatalogue: async () => withPreview.map((s) => ({ ...s })),
    writeCatalogue: async () => {},
  }
  const skipped = await run({ ...DEFAULTS, delay: 0 }, deps)
  assert.equal(skipped.matched, 0)
  assert.equal(calls, 0, 'no request made for an already-populated song')

  const forced = await run({ ...DEFAULTS, delay: 0, force: true }, deps)
  assert.equal(forced.matched, 1)
  assert.ok(calls > 0)
})

test('run reports misses without writing them', async () => {
  let written = null
  const res = await run(
    { ...DEFAULTS, delay: 0 },
    {
      fetch: async () => ok([wrong]),
      log: () => {},
      readCatalogue: async () => [{ ...song }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(res.matched, 0)
  assert.equal(res.missed, 1)
  assert.equal(written, null, 'nothing written when nothing matched')
})

test('--dry-run never writes', async () => {
  let written = null
  const res = await run(
    { ...DEFAULTS, delay: 0, dryRun: true },
    {
      fetch: async () => ok([hit]),
      log: () => {},
      readCatalogue: async () => [{ ...song }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(res.matched, 1)
  assert.equal(written, null)
})

test('--only narrows to one song', async () => {
  let calls = 0
  const res = await run(
    { ...DEFAULTS, delay: 0, only: 'other' },
    {
      fetch: async () => { calls++; return ok([hit]) },
      log: () => {},
      readCatalogue: async () => [{ ...song }, { ...song, id: 'other' }],
      writeCatalogue: async () => {},
    },
  )
  assert.equal(res.matched, 1)
  assert.ok(calls >= 1)
})

test('the curated year survives: Apple reports reissue dates, not recording dates', async () => {
  let written = null
  await run(
    { ...DEFAULTS, delay: 0 },
    {
      fetch: async () => ok([{ ...hit, releaseDate: '1999-06-04T07:00:00Z' }]),
      log: () => {},
      readCatalogue: async () => [{ ...song, year: 1234 }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(written[0].year, 1234, 'a reissue date must not overwrite the curated year')
})

test('a release date never touches the year at all', async () => {
  let written = null
  await run(
    { ...DEFAULTS, delay: 0 },
    {
      fetch: async () => ok([{ ...hit, releaseDate: undefined }]),
      log: () => {},
      readCatalogue: async () => [{ ...song, year: 2000 }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(written[0].year, 2000)
})


test('the chosen Apple track is recorded on the song', async () => {
  let written = null
  await run(
    { ...DEFAULTS, delay: 0 },
    {
      fetch: async () => ok([{ ...hit, collectionName: 'Greatest Hits' }]),
      log: () => {},
      readCatalogue: async () => [{ ...song }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  const m = written[0].matchedAs
  assert.ok(m, 'matchedAs must be written so a bad match is visible without listening')
  assert.equal(m.track, 'Tamally Maak')
  assert.equal(m.artist, 'Amr Diab')
  assert.equal(m.album, 'Greatest Hits')
  assert.ok(typeof m.score === 'number' && m.score > 0.9)
})

test('a forced re-fetch that fails clears the stale preview', async () => {
  // Otherwise a match rejected by the new rules stays live, and later store
  // fronts skip the song because it still looks populated.
  let written = null
  const stale = {
    ...song,
    previewUrl: 'https://old/wrong.m4a',
    artwork: 'https://old/art.jpg',
    matchedAs: { track: 'Wrong Song', artist: 'Wrong Artist', score: 0.6 },
  }
  await run(
    { ...DEFAULTS, delay: 0, force: true },
    {
      fetch: async () => ok([wrong]),           // nothing acceptable
      log: () => {},
      readCatalogue: async () => [{ ...stale }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.ok(written, 'the cleared catalogue must be written')
  assert.equal(written[0].previewUrl, undefined, 'stale url removed')
  assert.equal(written[0].artwork, undefined)
  assert.equal(written[0].matchedAs, undefined)
})

test('an unforced miss leaves an existing preview untouched', async () => {
  let written = null
  const kept = { ...song, previewUrl: 'https://keep/this.m4a' }
  const res = await run(
    { ...DEFAULTS, delay: 0, force: false },
    {
      fetch: async () => ok([wrong]),
      log: () => {},
      readCatalogue: async () => [{ ...kept }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(res.matched, 0)
  assert.equal(written, null, 'nothing to write: the song was skipped, not cleared')
})

test('searchAs pins the query, overriding the derived ones', () => {
  const pinned = { ...song, searchAs: 'Umm Kulthum Alf Leila W Leila 1969' }
  assert.deepEqual(buildQueries(pinned), ['Umm Kulthum Alf Leila W Leila 1969'])
  // without it, the derived Latin-then-Arabic pair is used
  assert.ok(buildQueries(song).length > 1)
})

test('transliteration variants of the same title score high', () => {
  // These are the same songs spelled differently by Apple; word-token overlap
  // rated them 0.33 and buried real errors among the false ones.
  for (const [a, b] of [
    ['Tamally Maak', 'Tamly Maak'],
    ['Boushret Kheir', 'Boshret Kheir'],
    ['Majida El Roumi', 'Magida El Roumi'],
    ['Fog El Nakhal', 'Fouk el nakhal'],
  ]) {
    assert.ok(similarity(a, b) > 0.65, `${a} ~ ${b} scored ${similarity(a, b).toFixed(2)}`)
  }
})

test('unrelated titles still score zero', () => {
  assert.equal(similarity('Tamally Maak', 'Zay El Hawa'), 0)
})

test('similarity alone cannot separate titles that share words', () => {
  // Documented deliberately: "Zay El Hawa" vs "El Hawa Hawaya" are different
  // songs but overlap heavily, so no threshold separates them. Songs like
  // these are pinned with searchAs instead of trusted to fuzzy matching.
  assert.ok(similarity('Zay El Hawa', 'El Hawa Hawaya') > 0.6)
  assert.ok(similarity('El Leila', 'El Farha El Leila') > 0.6)
})

test('retired songs are never looked up again', async () => {
  let calls = 0
  const res = await run(
    { ...DEFAULTS, delay: 0, force: true },
    {
      fetch: async () => { calls++; return ok([hit]) },
      log: () => {},
      readCatalogue: async () => [{ ...song, retired: true }],
      writeCatalogue: async () => {},
    },
  )
  assert.equal(calls, 0, 'not even --force should resurface a retired song')
  assert.equal(res.matched, 0)
})

test('--only still reaches a retired song when named explicitly', async () => {
  let calls = 0
  await run(
    { ...DEFAULTS, delay: 0, only: 'tamally-maak' },
    {
      fetch: async () => { calls++; return ok([hit]) },
      log: () => {},
      readCatalogue: async () => [{ ...song, retired: true }],
      writeCatalogue: async () => {},
    },
  )
  assert.ok(calls > 0, 'naming a song directly overrides retirement')
})
