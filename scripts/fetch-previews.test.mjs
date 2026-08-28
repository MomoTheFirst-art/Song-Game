import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  similarity, scoreCandidate, pickBest, buildQueries, searchUrl, lookup, parseArgs, run, DEFAULTS,
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
  assert.equal(scoreCandidate(song, noPreview), 0)
  assert.ok(scoreCandidate(song, hit) > 0.9)
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
