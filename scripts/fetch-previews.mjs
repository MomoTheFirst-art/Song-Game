#!/usr/bin/env node
/**
 * Fill in `previewUrl` for each song in the catalogue from the iTunes and
 * Deezer search APIs.
 *
 * Both still serve 30-second previews for free with no authentication, which
 * is why clip games kept working after Spotify withdrew `preview_url` in
 * November 2024. Apple is asked first — its Arabic metadata fits this
 * catalogue better — and Deezer covers what Apple does not carry. Neither
 * sends CORS headers on search, so the lookup happens here rather than in the
 * browser; the page only ever touches the audio CDN.
 *
 * Run it, review what it matched, commit the catalogue. Nothing is downloaded:
 * previews stream from the rights holder's own CDN to the player, which is
 * both the lighter and the licensable arrangement.
 *
 *   node scripts/fetch-previews.mjs --dry-run
 *   node scripts/fetch-previews.mjs --country EG
 *   node scripts/fetch-previews.mjs --source deezer
 *   node scripts/fetch-previews.mjs --only tamally-maak --force
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalize } from '../src/game/search.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CATALOGUE = path.join(HERE, '..', 'src', 'data', 'songs.json')
const ITUNES = 'https://itunes.apple.com/search'
const DEEZER = 'https://api.deezer.com/search'

/**
 * Minimum artist resemblance for any match. Famous titles are re-recorded and
 * re-used constantly — "ألف ليلة وليلة" alone names songs by several artists —
 * and a perfect title carries 0.65 on its own, which clears the combined bar
 * with a completely wrong performer. The artist has to be plausible too.
 */
export const MIN_ARTIST_SIMILARITY = 0.4

export const DEFAULTS = {
  country: 'SA',      // Saudi store — good Arabic coverage; try EG, AE, LB
  delay: 3000,        // Apple asks for roughly 20 calls a minute
  limit: 10,
  minScore: 0.55,
  // Lowerable per run: cartoon themes credit a studio, a channel or nobody,
  // so the floor that protects the song catalogue rejects almost everything
  // there. Lowering it leans harder on the review step, which is why it is a
  // flag rather than a new default.
  minArtist: MIN_ARTIST_SIMILARITY,
  only: null,
  force: false,
  dryRun: false,
  sources: ['itunes', 'deezer'],
  in: CATALOGUE,
  out: null,          // defaults to `in`
}

// ---------------------------------------------------------------- matching

/**
 * Dice coefficient over character bigrams. Transliteration is the whole
 * problem here: "Tamally" and "Tamly" are the same word and share almost every
 * bigram, but as word tokens they do not match at all. Token overlap alone
 * scored such pairs 0.33 and buried genuine errors among them.
 */
const squeeze = (t) => normalize(t || '').replace(/\s+/g, '')

const lengthRatio = (a, b) => {
  const x = squeeze(a)
  const y = squeeze(b)
  if (!x || !y) return 0
  return Math.min(x.length, y.length) / Math.max(x.length, y.length)
}

export function bigramSimilarity(a, b) {
  const x = squeeze(a)
  const y = squeeze(b)
  if (!x || !y) return 0

  const grams = (t) => {
    const set = new Set()
    for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2))
    return set
  }
  const A = grams(x)
  const B = grams(y)
  if (A.size === 0 || B.size === 0) return 0
  let shared = 0
  for (const g of A) if (B.has(g)) shared++
  return (2 * shared) / (A.size + B.size)
}

/**
 * Agreement between two performer names.
 *
 * Same measures as a title, except the bigram fallback is withheld when one
 * name is far shorter than the other. A short name's few bigrams land inside a
 * long one by coincidence: "Shadia" scored 0.50 against "Abadi Al Johar" on
 * nothing but ad/di/ia/ha, cleared the artist floor, and handed عبادي الجوهر a
 * Shadia recording.
 *
 * Deliberately not applied to titles. The same ratio would have refused
 * "Nawilak" for ناويلك على نية and two other clips already approved in review:
 * a catalogue holding the long form of a title while the release carries the
 * short one is ordinary, whereas two performers whose names differ that much
 * in length are simply different people.
 */
const MIN_ARTIST_LENGTH_RATIO = 0.75

export function artistSimilarity(a, b) {
  const bigrams = lengthRatio(a, b) >= MIN_ARTIST_LENGTH_RATIO ? bigramSimilarity(a, b) : 0
  return Math.max(tokenSimilarity(a, b), bigrams)
}

/** 0..1 similarity over normalized text, tolerant of extra words. */
export function tokenSimilarity(a, b) {
  const x = normalize(a || '')
  const y = normalize(b || '')
  if (!x || !y) return 0
  if (x === y) return 1
  if (x.includes(y) || y.includes(x)) return 0.85

  const A = new Set(x.split(' ').filter(Boolean))
  const B = new Set(y.split(' ').filter(Boolean))
  if (A.size === 0 || B.size === 0) return 0
  let shared = 0
  for (const t of A) if (B.has(t)) shared++
  return shared / new Set([...A, ...B]).size
}

/**
 * Whole-string agreement: the better of word overlap and character bigrams.
 * Word overlap catches reordering and extra words; bigrams catch spelling
 * drift between transliterations of the same Arabic title.
 */
export function similarity(a, b) {
  return Math.max(tokenSimilarity(a, b), bigramSimilarity(a, b))
}

/**
 * Title carries more weight than artist: compilations and features mangle the
 * artist field far more often than they mangle the track name. Returns the
 * parts as well as the total so the artist floor can be applied separately.
 */
export function scoreCandidate(song, candidate) {
  if (!candidate || !candidate.previewUrl) return { score: 0, title: 0, artist: 0 }
  const title = Math.max(
    similarity(song.title, candidate.trackName),
    similarity(song.titleLatin, candidate.trackName),
  )
  const artist = Math.max(
    artistSimilarity(song.artist, candidate.artistName),
    artistSimilarity(song.artistLatin, candidate.artistName),
  )
  return { score: 0.65 * title + 0.35 * artist, title, artist }
}

export function pickBest(song, results, minScore = DEFAULTS.minScore, taken = new Set(), minArtist = MIN_ARTIST_SIMILARITY) {
  const ranked = (results || [])
    .map((c) => ({ candidate: c, ...scoreCandidate(song, c) }))
    .sort((a, b) => b.score - a.score)

  // A right title by the wrong artist is the failure this guards against, so
  // the artist floor is checked per candidate rather than on the top one only:
  // a weaker-scoring result by the actual performer beats a perfect title.
  //
  // `taken` rules out audio another song in the catalogue already holds. Two
  // entries cannot legitimately be the same recording, so a duplicate preview
  // is proof of a mismatch no score threshold catches: كده يا قلبي matched the
  // artist perfectly, cleared 0.55 on title, and was handed صبري قليل's clip.
  const eligible = ranked.filter(
    (r) =>
      r.score >= minScore &&
      r.artist >= minArtist &&
      !taken.has(r.candidate.previewUrl),
  )
  const top = eligible[0]
  if (top) return { match: top.candidate, score: top.score, artistScore: top.artist, ranked }

  // Say which guard actually refused, not just the top score. Reporting
  // "no match above 0.55 (best 0.74)" was self-contradicting: 0.74 clears the
  // threshold, and the real reason — every candidate failed the artist floor —
  // was invisible. Without it a miss cannot be told apart from a song Apple
  // simply does not carry, so there is nothing to act on.
  const best = ranked[0]
  if (!best) return { match: null, score: 0, reason: 'no results', ranked }
  const overBar = ranked.filter((r) => r.score >= minScore)
  const reason = overBar.length === 0
    ? `best ${best.score.toFixed(2)} < ${minScore}`
    : overBar.every((r) => r.artist < minArtist)
      ? `wrong artist (“${overBar[0].candidate.artistName}”, ${overBar[0].artist.toFixed(2)})`
      : `clip already taken by another song`
  return { match: null, score: best.score, reason, ranked }
}

/** Latin transliterations match Apple's catalogue more often; Arabic is the retry. */
export function buildQueries(song) {
  // An explicit override wins outright: some titles are shared by several
  // recordings and no derived query separates them, so the catalogue can pin
  // the exact search that finds the right one.
  if (song.searchAs) return [song.searchAs]

  // Where the performer is the work — a cartoon opening belongs to its show,
  // not to whichever singer recorded the dub — artist and title are the same
  // string, and pairing them searched for "Adnan wa Lina Adnan wa Lina".
  const pair = (artist, title) =>
    [artist, artist === title ? '' : title].filter(Boolean).join(' ').trim()

  const queries = []
  const latin = pair(song.artistLatin, song.titleLatin)
  const arabic = pair(song.artist, song.title)
  if (latin) queries.push(latin)
  if (arabic && arabic !== latin) queries.push(arabic)
  if (song.titleLatin) queries.push(song.titleLatin)
  return [...new Set(queries)]
}

export function searchUrl(term, opts) {
  const u = new URL(ITUNES)
  u.searchParams.set('term', term)
  u.searchParams.set('media', 'music')
  u.searchParams.set('entity', 'song')
  u.searchParams.set('limit', String(opts.limit))
  if (opts.country) u.searchParams.set('country', opts.country)
  return u.toString()
}

export function deezerUrl(term, opts) {
  const u = new URL(DEEZER)
  u.searchParams.set('q', term)
  u.searchParams.set('limit', String(opts.limit))
  return u.toString()
}

/**
 * Deezer's track onto the shape the scorer already reads.
 *
 * Everything downstream — the title/artist weighting, the artist floor, the
 * duplicate-preview guard — is about a candidate, not about Apple, so a second
 * source only has to arrive in the same shape. `preview` is empty on tracks
 * Deezer has not excerpted; scoreCandidate already refuses a candidate with no
 * audio, so those rank themselves out.
 */
export function fromDeezer(track) {
  return {
    trackName: track.title,
    artistName: track.artist?.name,
    collectionName: track.album?.title,
    previewUrl: track.preview || undefined,
    artworkUrl100: track.album?.cover_medium || track.album?.cover,
  }
}

/**
 * Where clips come from. Apple is first because its Arabic metadata is the
 * better match for this catalogue; Deezer covers what Apple does not carry.
 *
 * Deezer answers errors with HTTP 200 and an `error` object, so a failed
 * lookup there looks exactly like a song with no results unless it is read.
 */
export const SOURCES = {
  itunes: {
    label: 'iTunes',
    url: searchUrl,
    results: (body) => {
      if (!Array.isArray(body.results)) throw new Error('no results array')
      return body.results
    },
  },
  deezer: {
    label: 'Deezer',
    url: deezerUrl,
    results: (body) => {
      if (body.error) throw new Error(`${body.error.type || 'error'}: ${body.error.message || ''}`.trim())
      if (!Array.isArray(body.data)) throw new Error('no data array')
      return body.data.map(fromDeezer)
    },
  },
}

// ---------------------------------------------------------------- lookup

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Try each query in turn, stopping at the first acceptable match. */
export async function lookup(song, opts, fetchImpl = globalThis.fetch, taken = new Set(), sourceKey = 'itunes') {
  const source = SOURCES[sourceKey]
  if (!source) throw new Error(`unknown source: ${sourceKey}`)
  let best = { match: null, score: 0 }

  for (const term of buildQueries(song)) {
    let res
    try {
      res = await fetchImpl(source.url(term, opts))
    } catch (err) {
      return { match: null, score: 0, error: `${source.label}: network: ${err.message}` }
    }
    if (res.status === 403) {
      return { match: null, score: 0, error: `${source.label}: rate limited (403) — raise --delay` }
    }
    if (!res.ok) return { match: null, score: 0, error: `${source.label}: HTTP ${res.status}` }

    let candidates
    try {
      candidates = source.results(await res.json())
    } catch (err) {
      return { match: null, score: 0, error: `${source.label}: ${err.message}` }
    }

    const attempt = pickBest(song, candidates, opts.minScore, taken, opts.minArtist ?? MIN_ARTIST_SIMILARITY)
    if (attempt.score > best.score) best = { ...attempt, term, source: sourceKey }
    if (attempt.match) return { ...attempt, term, source: sourceKey }
    if (opts.delay) await sleep(opts.delay)
  }
  return best
}

// ---------------------------------------------------------------- cli

export function parseArgs(argv) {
  const opts = { ...DEFAULTS }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--country') opts.country = next()
    else if (a === '--delay') opts.delay = Number(next())
    else if (a === '--limit') opts.limit = Number(next())
    else if (a === '--min-score') opts.minScore = Number(next())
    else if (a === '--min-artist') opts.minArtist = Number(next())
    else if (a === '--only') opts.only = next()
    else if (a === '--source') {
      opts.sources = next().split(/[ ,]+/).filter(Boolean)
      const bad = opts.sources.filter((k) => !SOURCES[k])
      if (bad.length) throw new Error(`unknown source: ${bad.join(', ')} (have ${Object.keys(SOURCES).join(', ')})`)
    }
    else if (a === '--in') opts.in = next()
    else if (a === '--out') opts.out = next()
    else if (a === '--force') opts.force = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown option: ${a}`)
  }
  if (!opts.out) opts.out = opts.in
  return opts
}

const HELP = `
Fill in previewUrl for each song from the iTunes and Deezer search APIs.

  node scripts/fetch-previews.mjs [options]

  --country XX     iTunes store front (default ${DEFAULTS.country}; try EG, AE, LB, US)
  --delay MS       pause between requests (default ${DEFAULTS.delay}; Apple suggests ~20/min)
  --limit N        candidates to weigh per query (default ${DEFAULTS.limit})
  --min-score N    0..1 acceptance threshold (default ${DEFAULTS.minScore})
  --min-artist N   0..1 artist floor (default ${DEFAULTS.minArtist}; lower it for
                   cartoon themes, whose performer credits are unreliable)
  --only ID        look up a single song by its catalogue id
  --source LIST    where to look, in order (default "${DEFAULTS.sources.join(' ')}")
  --force          re-fetch songs that already have a previewUrl
  --dry-run        report matches without writing the file
  --in PATH        catalogue to read  (default src/data/songs.json)
  --out PATH       catalogue to write (default: same as --in)
  -h, --help       this text

Previews stream from the source's own CDN to the browser; nothing is
downloaded or stored.
`.trim()

export async function run(opts, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch
  const log = deps.log || console.log
  const readCatalogue = deps.readCatalogue || (async () => JSON.parse(await readFile(opts.in, 'utf8')))
  const writeCatalogue = deps.writeCatalogue ||
    (async (songs) => writeFile(opts.out, JSON.stringify(songs, null, 2) + '\n'))

  const songs = await readCatalogue()
  const targets = songs.filter((s) => {
    if (opts.only) return s.id === opts.only
    // Retired songs were rejected on two separate lookups from five store
    // fronts. Apple either does not carry the recording or carries only
    // compilations that outrank it, and further attempts just spend a
    // reviewer's time on the same wrong clips.
    if (s.retired) return false
    return opts.force || !s.previewUrl
  })

  if (targets.length === 0) {
    log('Nothing to look up. Use --force to refresh songs that already have a preview.')
    return { matched: 0, missed: 0, songs }
  }

  log(`Looking up ${targets.length} song(s) — ${opts.sources.map((k) => SOURCES[k].label).join(' then ')}`)
  log(`iTunes store front: ${opts.country}\n`)

  const missed = []
  let matched = 0

  // Every preview already spoken for, so a lookup cannot hand one song the
  // audio of another. Targets release their own URL first: a forced re-fetch
  // would otherwise be blocked by the very entry it is refreshing.
  const targeted = new Set(targets.map((s) => s.id))
  const taken = new Set(
    songs.filter((s) => s.previewUrl && !targeted.has(s.id)).map((s) => s.previewUrl),
  )

  for (let i = 0; i < targets.length; i++) {
    const song = targets[i]

    // Sources are tried in order and the first acceptable match wins, so a
    // fallback never overrides a clip the preferred source already found.
    //
    // A judgement from any source outranks a transport failure from another.
    // Overwriting the result each time let the last source's error bury the
    // first source's verdict — which under --force meant a stale preview the
    // run had actually rejected stayed in the catalogue, because clearing it
    // hangs off "no match" rather than "error".
    let result = { match: null, score: 0 }
    const failures = []
    for (const key of opts.sources) {
      const attempt = await lookup(song, opts, fetchImpl, taken, key)
      if (attempt.match) {
        result = attempt
        break
      }
      if (attempt.error) failures.push(attempt.error)
      else if (!result.reason || attempt.score > result.score) result = attempt
      if (opts.delay) await sleep(opts.delay)
    }
    if (!result.match && !result.reason && failures.length > 0) {
      result = { ...result, error: failures.join('; ') }
    }
    const { match, score, error, reason, source } = result

    if (error) {
      log(`  ✗ ${song.titleLatin || song.title} — ${error}`)
      missed.push({ song, reason: error })
    } else if (!match) {
      const why = reason || `best ${score.toFixed(2)}`
      log(`  ✗ ${song.titleLatin || song.title} — ${why}`)
      missed.push({ song, reason: why })
      // A forced re-fetch exists because the stored value is suspect. Leaving
      // it in place would keep a rejected match live AND make later store-front
      // passes skip the song, since it still looks populated.
      if (opts.force) {
        delete song.previewUrl
        delete song.artwork
        delete song.matchedAs
      }
    } else {
      matched++
      taken.add(match.previewUrl)
      song.previewUrl = match.previewUrl
      // Apple previews are already excerpted at a representative part of the
      // track, so the clip window starts at the top of the preview.
      song.startAt = 0
      if (match.artworkUrl100) song.artwork = match.artworkUrl100
      // Record what Apple actually returned. Without this a wrong match is
      // invisible in the catalogue and can only be found by listening.
      song.matchedAs = {
        track: match.trackName,
        artist: match.artistName,
        ...(match.collectionName ? { album: match.collectionName } : {}),
        score: Number(score.toFixed(2)),
        // Which catalogue answered. A clip that behaves oddly in the player is
        // otherwise untraceable to the source that supplied it.
        ...(source && source !== 'itunes' ? { source } : {}),
      }
      // Deliberately NOT taking match.releaseDate as the year. Apple reports
      // the date of the release the track sits on, which for this repertoire is
      // almost always a modern remaster or compilation — it returned 2019 for a
      // Sayed Darwish recording and 2010 for a 1947 Laila Mourad film song. The
      // curated year is an approximation, but it is an approximation of the
      // right thing.
      const flag = score < 0.8 ? '  ← check this one' : ''
      const via = source && source !== 'itunes' ? ` [${SOURCES[source].label}]` : ''
      log(`  ✓ ${song.titleLatin || song.title} → “${match.trackName}” / ${match.artistName} (${score.toFixed(2)})${via}${flag}`)
    }

    if (opts.delay && i < targets.length - 1) await sleep(opts.delay)
  }

  log(`\n${matched} matched, ${missed.length} missed.`)
  if (missed.length) {
    log('\nUnmatched — add them by hand, or try another --country:')
    for (const m of missed) log(`  · ${m.song.id} (${m.song.artistLatin} — ${m.song.titleLatin}) — ${m.reason}`)
  }

  const cleared = opts.force && missed.length > 0

  if (opts.dryRun) {
    log('\n--dry-run: nothing written.')
  } else if (matched > 0 || cleared) {
    await writeCatalogue(songs)
    log(`\nWrote ${opts.out}`)
  }

  return { matched, missed: missed.length, songs }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(err.message)
    console.error(`\n${HELP}`)
    process.exit(2)
  }
  if (opts.help) {
    console.log(HELP)
  } else {
    run(opts).catch((err) => {
      console.error(err.stack || err.message)
      process.exit(1)
    })
  }
}
