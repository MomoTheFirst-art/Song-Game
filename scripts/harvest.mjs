#!/usr/bin/env node
/**
 * Pull an artist's catalogue in bulk, for review.
 *
 * The other script is song-first: it is handed a title someone typed from
 * memory and goes looking for it. That is why 47 songs have no clip and why a
 * misremembered title is indistinguishable from one Apple does not carry.
 *
 * This is catalogue-first. Deezer's top-tracks endpoint returns a performer's
 * real releases, ordered by popularity, each already carrying a 30-second
 * preview — so nothing has to be matched, spelled correctly, or guessed. One
 * call per artist replaces three per song, and what comes back is by
 * construction a real recording with working audio.
 *
 * Harvested songs land unapproved, so they play only once they have been heard
 * in the review console, exactly like every other song.
 *
 *   node scripts/harvest.mjs --artist "عمرو دياب" --dry-run
 *   node scripts/harvest.mjs --artists-file artists.txt --into src/data/songs.json
 *   node scripts/harvest.mjs --artist "Eminem" --into src/data/english.json --limit 25
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { normalize } from '../src/game/search.ts'
import { DAILY_ORDER } from '../src/game/daily.ts'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const API = 'https://api.deezer.com'

export const DEFAULTS = {
  limit: 25,          // tracks per artist, most popular first
  delay: 400,         // Deezer allows far more than Apple; this is still polite
  into: path.join(HERE, '..', 'src', 'data', 'songs.json'),
  dryRun: false,
  minRank: 0,
}

// ------------------------------------------------------------- shaping

/**
 * Popularity decides difficulty. Deezer returns an artist's tracks most-played
 * first, so position in that list is the best signal available for how likely
 * a listener is to know a song — which is the only thing a tier means.
 */
export function difficultyFor(index, total) {
  if (total <= 1) return DAILY_ORDER[0]
  const share = index / total
  const tier = Math.min(DAILY_ORDER.length - 1, Math.floor(share * DAILY_ORDER.length))
  return DAILY_ORDER[tier]
}

/** A stable, readable id from Latin text, falling back to the Deezer track id. */
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

/** Deezer's track onto a catalogue entry. No verdict: review decides that. */
export function toSong(track, { difficulty, year }) {
  const title = track.title_short || track.title
  return {
    id: slugify(title, track.id),
    title,
    titleLatin: title,
    artist: track.artist?.name ?? '',
    artistLatin: track.artist?.name ?? '',
    year: year ?? 0,
    difficulty,
    previewUrl: track.preview,
    ...(track.album?.cover_medium ? { artwork: track.album.cover_medium } : {}),
    matchedAs: {
      track: track.title,
      artist: track.artist?.name ?? '',
      ...(track.album?.title ? { album: track.album.title } : {}),
      score: 1,
      source: 'deezer-harvest',
    },
    startAt: 0,
  }
}

const key = (s) => `${normalize(s.title)}|${normalize(s.artist)}`

/**
 * Keep only what the catalogue does not already hold.
 *
 * Three ways a harvest repeats itself: the same recording under a new id, the
 * same title by the same artist from a different release, and the same id. A
 * duplicate preview is the one that matters most — two entries sharing audio
 * is the bug the song lookup already guards against.
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

async function deezer(url, fetchImpl) {
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const body = await res.json()
  // Deezer answers its errors with HTTP 200 and an error object.
  if (body.error) throw new Error(body.error.message || body.error.type || 'Deezer error')
  return body
}

export async function findArtist(name, fetchImpl = globalThis.fetch) {
  const body = await deezer(`${API}/search/artist?q=${encodeURIComponent(name)}&limit=5`, fetchImpl)
  const hits = body.data ?? []
  if (hits.length === 0) return null
  // Exact name first, then the most-followed — "Fairuz" and a tribute act
  // sharing a name are told apart by audience, not by string distance.
  const exact = hits.find((a) => normalize(a.name) === normalize(name))
  return exact ?? hits.slice().sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0]
}

export async function topTracks(artistId, limit, fetchImpl = globalThis.fetch) {
  const body = await deezer(`${API}/artist/${artistId}/top?limit=${limit}`, fetchImpl)
  return body.data ?? []
}

/** Everything one artist contributes, already tiered. */
export async function harvestArtist(name, opts, fetchImpl = globalThis.fetch) {
  const artist = await findArtist(name, fetchImpl)
  if (!artist) return { name, artist: null, songs: [], reason: 'no such artist on Deezer' }

  const tracks = (await topTracks(artist.id, opts.limit, fetchImpl))
    .filter((t) => t.preview && (t.rank ?? 0) >= opts.minRank)
  const songs = tracks.map((t, i) => toSong(t, { difficulty: difficultyFor(i, tracks.length) }))
  return { name, artist, songs }
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
    else if (a === '--min-rank') opts.minRank = Number(next())
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--help' || a === '-h') opts.help = true
    else throw new Error(`unknown option: ${a}`)
  }
  return opts
}

const HELP = `
Pull artists' catalogues from Deezer in bulk, for review.

  node scripts/harvest.mjs --artist NAME [--artist NAME ...] [options]

  --artist NAME        a performer to harvest; repeatable
  --artists-file PATH  one performer per line (# comments allowed)
  --into PATH          catalogue to append to (default src/data/songs.json)
  --limit N            tracks per artist, most popular first (default ${DEFAULTS.limit})
  --min-rank N         drop tracks below this Deezer popularity rank
  --delay MS           pause between calls (default ${DEFAULTS.delay})
  --dry-run            report what would be added, write nothing
  -h, --help           this text

Everything lands unapproved: harvested songs play only once they have been
heard in the review console, like every other song.
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
