#!/usr/bin/env node
/**
 * Pull an artist's catalogue in bulk, for review.
 *
 * The other script is song-first: it is handed a title someone typed from
 * memory and goes looking for it. That is why 47 songs have no clip and why a
 * misremembered title is indistinguishable from one Apple does not carry.
 *
 * This is catalogue-first. Apple's lookup endpoint returns a performer's whole
 * discography in one call, each track with a stable preview URL — so a title
 * here is one that exists, spelled as the label spells it, rather than one
 * someone recalled, and it arrives with its audio already attached.
 *
 * Deezer was the source first. Its top-tracks endpoint is nicer to read and
 * ordered by popularity, but it signs previews with roughly a twelve-minute
 * expiry, so every clip was dead before anyone could review it. Apple's do not
 * expire, which for a committed catalogue outweighs everything else.
 *
 * Harvested songs land unapproved, so they play only once someone has heard
 * them.
 *
 *   node scripts/harvest.mjs --artist "عمرو دياب" --dry-run
 *   node scripts/harvest.mjs --artists-file artists.txt --into src/data/songs.json
 *   node scripts/harvest.mjs --artist "Eminem" --into src/data/english.json --limit 25
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalize } from '../src/game/search.ts'
import { fetchWithBackoff } from './fetch-previews.mjs'
import { DAILY_ORDER } from '../src/game/daily.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SEARCH = 'https://itunes.apple.com/search'
const LOOKUP = 'https://itunes.apple.com/lookup'

export const DEFAULTS = {
  limit: 200,         // Apple returns a whole discography in one call
  delay: 2500,        // Apple throttles hard; a 403 here costs the whole artist
  country: 'SA',
  into: path.join(HERE, '..', 'src', 'data', 'songs.json'),
  dryRun: false,
  minRank: 0,
}

// ------------------------------------------------------------- shaping

/**
 * Position decides difficulty. Apple returns a discography newest-first rather
 * than by popularity, which is a weaker signal than Deezer's ordering was —
 * so a tier here is a starting point for review, not a verdict. Review is
 * where a tier is really settled anyway.
 */
export function difficultyFor(index, total) {
  if (total <= 1) return DAILY_ORDER[0]
  const share = index / total
  const tier = Math.min(DAILY_ORDER.length - 1, Math.floor(share * DAILY_ORDER.length))
  return DAILY_ORDER[tier]
}

/** A stable, readable id from Latin text, falling back to the track id. */
export function slugify(text, fallback) {
  const slug = String(text || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || `dz-${fallback}`
}

/**
 * Apple's track onto a catalogue entry, audio included.
 *
 * `artistIsTitle` is for repertoire where the performer is the work: a cartoon
 * opening belongs to its show, and nobody recalls which singer recorded the
 * dub.
 */
export function toSong(track, { difficulty, artistIsTitle = false }) {
  const title = track.trackName
  const artist = artistIsTitle ? title : track.artistName ?? ''
  return {
    id: slugify(title, track.trackId),
    title,
    titleLatin: title,
    artist,
    artistLatin: artist,
    year: Number(String(track.releaseDate ?? '').slice(0, 4)) || 0,
    difficulty,
    previewUrl: track.previewUrl,
    ...(track.artworkUrl100 ? { artwork: track.artworkUrl100 } : {}),
    matchedAs: {
      track: track.trackName,
      artist: track.artistName ?? '',
      ...(track.collectionName ? { album: track.collectionName } : {}),
      score: 1,
      source: 'itunes-harvest',
    },
    startAt: 0,
  }
}

const key = (s) => `${normalize(s.title)}|${normalize(s.artist)}`

/**
 * Keep only what the catalogue does not already hold: the same audio, the same
 * title by the same artist, or the same id. Two entries sharing a clip is the
 * bug the song lookup already guards against, and a discography contains the
 * same recording on a single, an album and a compilation.
 */
export function dedupe(candidates, existing) {
  const urls = new Set(existing.map((s) => s.previewUrl).filter(Boolean))
  const names = new Set(existing.map(key))
  const ids = new Set(existing.map((s) => s.id))
  const kept = []
  const skipped = []

  for (const c of candidates) {
    const why = !c.previewUrl
      ? 'no preview'
      : urls.has(c.previewUrl)
        ? 'clip already in the catalogue'
        : names.has(key(c))
          ? 'already have this title by this artist'
          : null
    if (why) {
      skipped.push({ song: c, why })
      continue
    }
    // Only now is the id worth settling, since a skipped candidate must not
    // consume a suffix.
    let id = c.id
    for (let n = 2; ids.has(id); n++) id = `${c.id}-${n}`
    const song = { ...c, id }
    ids.add(id)
    urls.add(song.previewUrl)
    names.add(key(song))
    kept.push(song)
  }
  return { kept, skipped }
}

// -------------------------------------------------------------- lookup

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Apple throttles hard and answers a throttled request with an empty body, so
 * JSON.parse fails rather than anything saying "rate limited". A 403 costs a
 * whole artist here, not one song, so it is worth retrying properly.
 */
async function apple(url, fetchImpl) {
  const res = await fetchWithBackoff(url, fetchImpl)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (!text.trim()) throw new Error('empty response (throttled)')
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('unparseable response')
  }
}

export async function findArtist(name, opts = DEFAULTS, fetchImpl = globalThis.fetch) {
  const url = `${SEARCH}?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5&country=${opts.country}`
  const hits = (await apple(url, fetchImpl)).results ?? []
  if (hits.length === 0) return null
  // An exact name wins outright: searching a performer turns up tribute acts
  // and sound-alikes, and Apple does not rank by audience.
  const exact = hits.find((a) => normalize(a.artistName) === normalize(name))
  return exact ?? hits[0]
}

export async function artistSongs(artistId, opts = DEFAULTS, fetchImpl = globalThis.fetch) {
  const url = `${LOOKUP}?id=${artistId}&entity=song&limit=${opts.limit}&country=${opts.country}`
  const body = await apple(url, fetchImpl)
  // The first result is the artist record itself, not a track.
  return (body.results ?? []).filter((r) => r.wrapperType === 'track')
}

/** Everything one artist contributes, already tiered. */
export async function harvestArtist(name, opts, fetchImpl = globalThis.fetch) {
  const artist = await findArtist(name, opts, fetchImpl)
  if (!artist) return { name, artist: null, songs: [], reason: 'no such artist on iTunes' }

  const tracks = (await artistSongs(artist.artistId, opts, fetchImpl))
    .filter((t) => t.previewUrl)
  const songs = tracks.map((t, i) =>
    toSong(t, {
      difficulty: difficultyFor(i, tracks.length),
      artistIsTitle: opts.artistIsTitle,
    }),
  )
  return { name, artist: { name: artist.artistName, id: artist.artistId }, songs }
}

// ----------------------------------------------------------------- cli

export function parseArgs(argv) {
  const opts = { ...DEFAULTS, artists: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    if (a === '--artist') opts.artists.push(next())
    else if (a === '--artists-file') opts.artistsFile = next()
    else if (a === '--into') opts.into = next()
    else if (a === '--limit') opts.limit = Number(next())
    else if (a === '--delay') opts.delay = Number(next())
    else if (a === '--country') opts.country = next()
    else if (a === '--artist-is-title') opts.artistIsTitle = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown option: ${a}`)
  }
  return opts
}

const HELP = `
Pull artists' catalogues from iTunes in bulk, for review.

  node scripts/harvest.mjs --artist NAME [--artist NAME ...] [options]

  --artist NAME        a performer to harvest; repeatable
  --artists-file PATH  one performer per line (# comments allowed)
  --into PATH          catalogue to append to (default src/data/songs.json)
  --limit N            tracks to pull per artist (default ${DEFAULTS.limit})
  --country XX         iTunes store front (default ${DEFAULTS.country})
  --artist-is-title    credit each song to itself, for repertoire where the
                       performer is the work (cartoon openings)
  --delay MS           pause between calls (default ${DEFAULTS.delay})
  --dry-run            report what would be added, write nothing
  -h, --help           this text

Clips come from Apple and do not expire. Harvested songs land unapproved and
play only once they have been heard in the review console.
`.trim()

export async function run(opts, deps = {}) {
  const fetchImpl = deps.fetch || globalThis.fetch
  const log = deps.log || console.log
  const readCatalogue = deps.readCatalogue || (async () => JSON.parse(await readFile(opts.into, 'utf8')))
  const writeCatalogue = deps.writeCatalogue ||
    (async (songs) => writeFile(opts.into, JSON.stringify(songs, null, 2) + '\n'))

  let names = [...opts.artists]
  if (opts.artistsFile) {
    const text = deps.readArtists
      ? await deps.readArtists()
      : await readFile(opts.artistsFile, 'utf8')
    names.push(...text.split('\n').map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean))
  }
  names = [...new Set(names)]
  if (names.length === 0) {
    log('No artists given. Use --artist or --artists-file.')
    return { added: 0, songs: [] }
  }

  const existing = await readCatalogue()
  log(`Harvesting ${names.length} artist(s) into ${opts.into} (${existing.length} already there)\n`)

  const candidates = []
  const failures = []
  for (let i = 0; i < names.length; i++) {
    const name = names[i]
    let got
    try {
      got = await harvestArtist(name, opts, fetchImpl)
    } catch (err) {
      failures.push({ name, reason: err.message })
      log(`  ✗ ${name} — ${err.message}`)
      continue
    }
    if (!got.artist) {
      failures.push({ name, reason: got.reason })
      log(`  ✗ ${name} — ${got.reason}`)
    } else {
      log(`  ✓ ${name} → ${got.artist.name}: ${got.songs.length} track(s) with previews`)
      candidates.push(...got.songs)
    }
    if (opts.delay && i < names.length - 1) await sleep(opts.delay)
  }

  const { kept, skipped } = dedupe(candidates, existing)

  log(`\n${candidates.length} harvested, ${kept.length} new, ${skipped.length} already covered.`)
  const byTier = {}
  for (const s of kept) byTier[s.difficulty] = (byTier[s.difficulty] ?? 0) + 1
  if (kept.length) log(`New by tier: ${DAILY_ORDER.map((t) => `${t} ${byTier[t] ?? 0}`).join(', ')}`)
  for (const s of kept) log(`  + ${s.artist} — ${s.title}  [${s.difficulty}]`)

  if (opts.dryRun) {
    log('\n--dry-run: nothing written.')
  } else if (kept.length) {
    await writeCatalogue([...existing, ...kept])
    log(`\nWrote ${opts.into} — ${kept.length} song(s) added, all awaiting review.`)
  }

  return { added: kept.length, skipped: skipped.length, failures, songs: kept }
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
  if (opts.help) console.log(HELP)
  else run(opts).catch((err) => { console.error(err.stack || err.message); process.exit(1) })
}
