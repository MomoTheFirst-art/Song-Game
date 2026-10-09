import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  similarity, scoreCandidate, pickBest, buildQueries, searchUrl, lookup, parseArgs, run, DEFAULTS,
  MIN_ARTIST_SIMILARITY, SOURCES, deezerUrl, fromDeezer, artistSimilarity, bigramSimilarity,
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

test('a miss says which guard refused it', () => {
  // "no match above 0.55 (best 0.74)" was self-contradicting and sent me
  // looking for absent recordings when the artist floor was doing the work.
  const wrongArtist = { trackName: 'Tamally Maak', artistName: 'Nobody At All', previewUrl: 'https://x/1.m4a' }
  const refused = pickBest(song, [wrongArtist], 0.55)
  assert.equal(refused.match, null)
  assert.match(refused.reason, /wrong artist/)
  assert.match(refused.reason, /Nobody At All/)

  const weak = pickBest(song, [{ trackName: 'Something Else', artistName: 'Amr Diab', previewUrl: 'https://x/2.m4a' }], 0.55)
  assert.equal(weak.match, null)
  assert.match(weak.reason, /< 0\.55/)

  assert.equal(pickBest(song, [], 0.55).reason, 'no results')

  const claimed = pickBest(song, [hit], 0.55, new Set([hit.previewUrl]))
  assert.equal(claimed.match, null)
  assert.match(claimed.reason, /already taken/)
})

// ------------------------------------------------------------ deezer

/** One track as Deezer's search returns it, trimmed to the fields read. */
const deezerTrack = (title, artist, preview = 'https://cdns-preview-x.dzcdn.net/stream/a.mp3') => ({
  id: 1,
  title,
  title_short: title,
  preview,
  artist: { id: 2, name: artist },
  album: { id: 3, title: `${title} - Single`, cover_medium: 'https://e-cdns-images.dzcdn.net/c.jpg' },
})

test('a Deezer track maps onto the shape the scorer reads', () => {
  const c = fromDeezer(deezerTrack('Tamally Maak', 'Amr Diab'))
  assert.equal(c.trackName, 'Tamally Maak')
  assert.equal(c.artistName, 'Amr Diab')
  assert.equal(c.collectionName, 'Tamally Maak - Single')
  assert.match(c.previewUrl, /^https:\/\/cdns-preview/)
  assert.ok(c.artworkUrl100, 'artwork carries over so the reveal still shows a cover')
})

test('a Deezer track with no excerpt is not a candidate', () => {
  const c = fromDeezer(deezerTrack('Tamally Maak', 'Amr Diab', ''))
  assert.equal(c.previewUrl, undefined)
  assert.equal(scoreCandidate(song, c).score, 0, 'a clip game cannot use a track with no clip')
})

test('a malformed Deezer track does not throw', () => {
  assert.doesNotThrow(() => fromDeezer({ title: 'x' }))
  assert.equal(fromDeezer({ title: 'x' }).artistName, undefined)
})

test('Deezer reports its errors with HTTP 200, so the body is what is read', () => {
  const quota = { error: { type: 'Exception', message: 'Quota limit exceeded', code: 4 } }
  assert.throws(() => SOURCES.deezer.results(quota), /Quota limit exceeded/)
  assert.throws(() => SOURCES.deezer.results({}), /no data array/)
  assert.deepEqual(SOURCES.deezer.results({ data: [] }), [])
})

test('the Deezer query is a plain q= search', () => {
  const u = new URL(deezerUrl('Amr Diab Tamally Maak', { limit: 10 }))
  assert.equal(u.origin + u.pathname, 'https://api.deezer.com/search')
  assert.equal(u.searchParams.get('q'), 'Amr Diab Tamally Maak')
  assert.equal(u.searchParams.get('limit'), '10')
})

test('both sources are scored by the same rules', () => {
  const apple = { trackName: 'Tamally Maak', artistName: 'Amr Diab', previewUrl: 'https://apple/a.m4a' }
  const deezer = fromDeezer(deezerTrack('Tamally Maak', 'Amr Diab'))
  assert.equal(
    scoreCandidate(song, apple).score.toFixed(4),
    scoreCandidate(song, deezer).score.toFixed(4),
    'a source must not change what a match is worth',
  )
})

test('a wrong artist is refused on Deezer exactly as on iTunes', () => {
  const results = SOURCES.deezer.results({
    data: [deezerTrack('Tamally Maak', 'Some Cover Band')],
  })
  const { match, reason } = pickBest(song, results)
  assert.equal(match, null)
  assert.match(reason, /wrong artist/)
})

test('a later source failing does not bury an earlier source’s verdict', async () => {
  // Regression: with two sources the loop overwrote the result each time, so
  // Deezer being unreachable masked iTunes having genuinely rejected every
  // candidate — and clearing a stale preview hangs off "no match", not
  // "error", so --force quietly kept audio the run had just refused.
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
      fetch: async (url) =>
        url.includes('deezer')
          ? Promise.reject(new Error('ENOTFOUND'))
          : ok([wrong]),                           // iTunes: nothing acceptable
      log: () => {},
      readCatalogue: async () => [{ ...stale }],
      writeCatalogue: async (s) => { written = s },
    },
  )
  assert.equal(written[0].previewUrl, undefined, 'the refused clip must still be cleared')
})

test('every source failing is reported as a failure, not as a miss', async () => {
  const lines = []
  await run(
    { ...DEFAULTS, delay: 0 },
    {
      fetch: async () => Promise.reject(new Error('ENOTFOUND')),
      log: (l) => lines.push(l),
      readCatalogue: async () => [{ ...song }],
      writeCatalogue: async () => {},
    },
  )
  const miss = lines.find((l) => l.includes('✗'))
  assert.match(miss, /iTunes/, 'the report must name which sources failed')
  assert.match(miss, /Deezer/)
})

test('Deezer is only asked for what iTunes did not find', async () => {
  const asked = []
  await run(
    { ...DEFAULTS, delay: 0 },
    {
      fetch: async (url) => {
        asked.push(url.includes('deezer') ? 'deezer' : 'itunes')
        return ok([hit])
      },
      log: () => {},
      readCatalogue: async () => [{ ...song }],
      writeCatalogue: async () => {},
    },
  )
  assert.deepEqual(asked, ['itunes'], 'a found clip must not cost a second lookup')
})

test('the artist floor is lowerable for repertoire with unreliable credits', () => {
  // A Spacetoon opening is routinely credited to a studio or to nobody, so the
  // floor that protects the song catalogue would reject the right recording.
  const theme = {
    id: 'sally', title: 'سالي', titleLatin: 'Sally',
    artist: 'طارق العربي طرقان', artistLatin: 'Tarek Al Arabi Tourgane',
    difficulty: 'easy', startAt: 0,
  }
  const candidates = [{ trackName: 'Sally', artistName: 'Spacetoon', previewUrl: 'https://x/s.m4a' }]

  assert.equal(pickBest(theme, candidates).match, null, 'the default floor still refuses it')
  assert.match(pickBest(theme, candidates).reason, /wrong artist/)

  const loosened = pickBest(theme, candidates, DEFAULTS.minScore, new Set(), 0)
  assert.ok(loosened.match, 'a lowered floor lets the review step decide instead')
})

test('lowering the artist floor does not lower the score threshold', () => {
  const junk = [{ trackName: 'Nothing Alike', artistName: 'Nobody', previewUrl: 'https://x/j.m4a' }]
  const { match, reason } = pickBest(song, junk, DEFAULTS.minScore, new Set(), 0)
  assert.equal(match, null, 'a bad title is still a bad match whoever sang it')
  assert.match(reason, /< 0.55/)
})

// -------------------------------------------------- short-name inflation

test('a short artist name does not match a long one on coincidence', () => {
  // Production failure: Deezer offered عبادي الجوهر a Shadia recording.
  // "Shadia" shares ad/di/ia/ha with "Abadi Al Johar" and nothing else, which
  // Dice scored 0.50 — over the 0.4 floor — on no real resemblance.
  assert.ok(artistSimilarity('Abadi Al Johar', 'Shadia') < MIN_ARTIST_SIMILARITY)
  assert.ok(artistSimilarity('Assala', 'Essam Sasa') < MIN_ARTIST_SIMILARITY)
  assert.equal(artistSimilarity('عبادي الجوهر', 'Shadia'), 0)
})

test('transliterations of the same performer still match', () => {
  for (const [a, b] of [
    ['Amr Diab', 'Amr Diyab'],
    ['Umm Kulthum', 'Om Kalthoum'],
    ['Rashed Al Majed', 'Rashed Almajed'],
    ['Sherine', 'Sherine Abdel Wahab'],
  ]) {
    assert.ok(
      artistSimilarity(a, b) >= MIN_ARTIST_SIMILARITY,
      `${a} / ${b} scored ${artistSimilarity(a, b).toFixed(2)}`,
    )
  }
})

test('the length guard is on artists only, not titles', () => {
  // A catalogue holding a title's long form while the release carries the
  // short one is ordinary — ناويلك على نية is released as "Nawilak", and two
  // other approved clips are the same shape. Guarding titles rejected all three.
  assert.ok(similarity('Nawilak Ala Niya', 'Nawilak') > 0.5, 'a long title must still find its short release')
  assert.ok(bigramSimilarity('Al Madi', 'Talal Madah') > 0, 'bigrams themselves stay unguarded')
})

test('a song whose performer is its own title is not searched for twice', () => {
  // Spacetoon credits the show, not the singer, so artist and title are the
  // same string — which paired into "Adnan wa Lina Adnan wa Lina".
  const theme = {
    id: 'adnan-lina', title: 'عدنان ولينا', titleLatin: 'Adnan wa Lina',
    artist: 'عدنان ولينا', artistLatin: 'Adnan wa Lina',
    difficulty: 'easy', startAt: 0,
  }
  const qs = buildQueries(theme)
  assert.deepEqual(qs, ['Adnan wa Lina', 'عدنان ولينا'])
  assert.equal(new Set(qs).size, qs.length, 'no query may repeat')
})

test('an ordinary song still pairs artist with title', () => {
  assert.deepEqual(buildQueries(song), ['Amr Diab Tamally Maak', 'عمرو دياب تملي معاك', 'Tamally Maak'])
})
