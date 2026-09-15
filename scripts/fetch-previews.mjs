#!/usr/bin/env node
/**
 * Fill in `previewUrl` for each song in the catalogue from the iTunes Search API.
 *
 * Apple still serves 30-second previews for free with no authentication, which
 * is why clip games kept working after Spotify withdrew `preview_url` in
 * November 2024. The API sends no CORS headers, so the lookup has to happen
 * here rather than in the browser — the page only ever touches Apple's CDN for
 * the audio itself.
 *
 * Run it, review what it matched, commit the catalogue. Nothing is downloaded:
 * previews stream from Apple to the player, which is both the lighter and the
 * licensable arrangement.
 *
 *   node scripts/fetch-previews.mjs --dry-run
 *   node scripts/fetch-previews.mjs --country EG
 *   node scripts/fetch-previews.mjs --only tamally-maak --force
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalize } from '../src/game/search.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const CATALOGUE = path.join(HERE, '..', 'src', 'data', 'songs.json')
const ENDPOINT = 'https://itunes.apple.com/search'

export const DEFAULTS = {
  country: 'SA',      // Saudi store — good Arabic coverage; try EG, AE, LB
  delay: 3000,        // Apple asks for roughly 20 calls a minute
  limit: 10,
  minScore: 0.55,
  only: null,
  force: false,
  dryRun: false,
  in: CATALOGUE,
  out: null,          // defaults to `in`
}

// ---------------------------------------------------------------- matching

/** 0..1 similarity over normalized text, tolerant of extra words. */
export function similarity(a, b) {
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
 * Title carries more weight than artist: compilations and features mangle the
 * artist field far more often than they mangle the track name.
 */
export function scoreCandidate(song, candidate) {
  if (!candidate || !candidate.previewUrl) return 0
  const title = Math.max(
    similarity(song.title, candidate.trackName),
    similarity(song.titleLatin, candidate.trackName),
  )
  const artist = Math.max(
    similarity(song.artist, candidate.artistName),
    similarity(song.artistLatin, candidate.artistName),
  )
  return 0.65 * title + 0.35 * artist
}

export function pickBest(song, results, minScore = DEFAULTS.minScore) {
  const ranked = (results || [])
    .map((c) => ({ candidate: c, score: scoreCandidate(song, c) }))
    .sort((a, b) => b.score - a.score)
  const top = ranked[0]
  if (!top || top.score < minScore) return { match: null, score: top ? top.score : 0, ranked }
  return { match: top.candidate, score: top.score, ranked }
}

/** Latin transliterations match Apple's catalogue more often; Arabic is the retry. */
export function buildQueries(song) {
  const queries = []
  const latin = [song.artistLatin, song.titleLatin].filter(Boolean).join(' ').trim()
  const arabic = [song.artist, song.title].filter(Boolean).join(' ').trim()
  if (latin) queries.push(latin)
  if (arabic && arabic !== latin) queries.push(arabic)
  if (song.titleLatin) queries.push(song.titleLatin)
  return queries
}

export function searchUrl(term, opts) {
  const u = new URL(ENDPOINT)
  u.searchParams.set('term', term)
  u.searchParams.set('media', 'music')
  u.searchParams.set('entity', 'song')
  u.searchParams.set('limit', String(opts.limit))
  if (opts.country) u.searchParams.set('country', opts.country)
  return u.toString()
}

// ---------------------------------------------------------------- lookup

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Try each query in turn, stopping at the first acceptable match. */
export async function lookup(song, opts, fetchImpl = globalThis.fetch) {
  let best = { match: null, score: 0 }

  for (const term of buildQueries(song)) {
    let res
    try {
      res = await fetchImpl(searchUrl(term, opts))
    } catch (err) {
      return { match: null, score: 0, error: `network: ${err.message}` }
    }
    if (res.status === 403) return { match: null, score: 0, error: 'rate limited (403) — raise --delay' }
    if (!res.ok) return { match: null, score: 0, error: `HTTP ${res.status}` }

    let body
    try {
      body = await res.json()
    } catch {
      return { match: null, score: 0, error: 'unparseable response' }
    }

    const attempt = pickBest(song, body.results, opts.minScore)
    if (attempt.score > best.score) best = { ...attempt, term }
    if (attempt.match) return { ...attempt, term }
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
    else if (a === '--only') opts.only = next()
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
Fill in previewUrl for each song from the iTunes Search API.

  node scripts/fetch-previews.mjs [options]

  --country XX     iTunes store front (default ${DEFAULTS.country}; try EG, AE, LB, US)
  --delay MS       pause between requests (default ${DEFAULTS.delay}; Apple suggests ~20/min)
  --limit N        candidates to weigh per query (default ${DEFAULTS.limit})
  --min-score N    0..1 acceptance threshold (default ${DEFAULTS.minScore})
  --only ID        look up a single song by its catalogue id
  --force          re-fetch songs that already have a previewUrl
  --dry-run        report matches without writing the file
  --in PATH        catalogue to read  (default src/data/songs.json)
  --out PATH       catalogue to write (default: same as --in)
  -h, --help       this text

Previews stream from Apple to the browser; nothing is downloaded or stored.
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
    return opts.force || !s.previewUrl
  })

  if (targets.length === 0) {
    log('Nothing to look up. Use --force to refresh songs that already have a preview.')
    return { matched: 0, missed: 0, songs }
  }

  log(`Looking up ${targets.length} song(s) in the ${opts.country} store…\n`)

  const missed = []
  let matched = 0

  for (let i = 0; i < targets.length; i++) {
    const song = targets[i]
    const { match, score, error } = await lookup(song, opts, fetchImpl)

    if (error) {
      log(`  ✗ ${song.titleLatin || song.title} — ${error}`)
      missed.push({ song, reason: error })
    } else if (!match) {
      log(`  ✗ ${song.titleLatin || song.title} — no match above ${opts.minScore} (best ${score.toFixed(2)})`)
      missed.push({ song, reason: `best score ${score.toFixed(2)}` })
    } else {
      matched++
      song.previewUrl = match.previewUrl
      // Apple previews are already excerpted at a representative part of the
      // track, so the clip window starts at the top of the preview.
      song.startAt = 0
      if (match.artworkUrl100) song.artwork = match.artworkUrl100
      // Deliberately NOT taking match.releaseDate as the year. Apple reports
      // the date of the release the track sits on, which for this repertoire is
      // almost always a modern remaster or compilation — it returned 2019 for a
      // Sayed Darwish recording and 2010 for a 1947 Laila Mourad film song. The
      // curated year is an approximation, but it is an approximation of the
      // right thing.
      const flag = score < 0.8 ? '  ← check this one' : ''
      log(`  ✓ ${song.titleLatin || song.title} → “${match.trackName}” / ${match.artistName} (${score.toFixed(2)})${flag}`)
    }

    if (opts.delay && i < targets.length - 1) await sleep(opts.delay)
  }

  log(`\n${matched} matched, ${missed.length} missed.`)
  if (missed.length) {
    log('\nUnmatched — add them by hand, or try another --country:')
    for (const m of missed) log(`  · ${m.song.id} (${m.song.artistLatin} — ${m.song.titleLatin}) — ${m.reason}`)
  }

  if (opts.dryRun) {
    log('\n--dry-run: nothing written.')
  } else if (matched > 0) {
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
