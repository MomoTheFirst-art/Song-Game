# 🎵 خمّن الأغنية — Arabic Song Guessing Game

Guess the Arabic song from a clip that starts at a tenth of a second. Modelled
on [Songspot](https://songspot.net/): the less you hear before you answer, the
more you score.

## How it works

Each round plays a clip of one song. Guess it or skip, and the clip gets longer:

| Stage | Clip length | Points if correct |
|-------|-------------|-------------------|
| 1 | 0.1s | 1200 |
| 2 | 0.5s | 975 |
| 3 | 2s | 750 |
| 4 | 8s | 525 |
| 5 | 15s | 300 |

Five wrong guesses or skips ends the round with no points.

**تحدي اليوم (Daily 5)** — five songs, one per difficulty tier, in the order
Easy → Medium → Hard → Expert → Impossible. The selection is derived from the
UTC date, so everyone playing on the same day gets the same five, and the run is
playable once per day. Results copy to the clipboard as an emoji grid.

**تدريب (Practice)** — unlimited, unranked, freshly shuffled every run.

## Running it

```bash
npm install
npm run dev
```

Then add audio. Two ways:

**Apple previews (no files to manage).** `scripts/fetch-previews.mjs` fills in a
`previewUrl` for each song from the iTunes Search API — free, no API key. See
[Fetching previews](#fetching-previews) below.

**Your own clips.** Drop files in `public/clips/`; see
[`public/clips/README.md`](public/clips/README.md) for naming rules and a note
on sourcing audio you have the right to use.

A song's `previewUrl` wins over its local `clip` when both are set.

```bash
npm run build      # production build to dist/
npm run typecheck  # tsc, no emit
npm test           # script unit tests
```

## Fetching previews

Apple still serves 30-second previews for free without authentication, which is
why clip games kept working after Spotify withdrew `preview_url` in November
2024. The lookup runs here rather than in the browser, because the Search API
sends no CORS headers.

```bash
node scripts/fetch-previews.mjs --dry-run     # see what it would match
node scripts/fetch-previews.mjs               # write previewUrl into songs.json
node scripts/fetch-previews.mjs --country EG  # a different store front
```

| Option | Purpose |
|--------|---------|
| `--country XX` | Store front (default `SA`; try `EG`, `AE`, `LB`, `US`) |
| `--delay MS` | Pause between calls (default 3000 — Apple suggests ~20/min) |
| `--min-score N` | Acceptance threshold, 0..1 (default 0.55) |
| `--only ID` | Look up one song |
| `--force` | Re-fetch songs that already have a preview |
| `--dry-run` | Report without writing |
| `--in` / `--out` | Read from / write to another file |

Matching is fuzzy, weighted 65% title and 35% artist, and reuses the same
Arabic folding as the in-game search so `أهواك` and `Ahwak` both resolve. Any
match below 0.8 is flagged `← check this one`; anything below the threshold is
left alone and listed at the end rather than guessed at. **Read the output** —
a wrong-but-confident match is the failure mode to watch for, so the script
deliberately refuses a result that matches only on artist.

Nothing is downloaded. Previews stream from Apple straight to the player, which
is both the lighter arrangement and the one that stays inside Apple's terms —
storing or re-serving the audio yourself is what turns this into redistribution.

### If previews won't play

Web Audio needs a CORS header to decode a cross-origin file. If Apple's CDN
doesn't send one, the player falls back automatically to an `<audio>` element,
which any origin allows, and says so on screen. The cost is precision: the
fallback lands within a few tens of milliseconds, which is invisible at the 8s
stage and quite visible at 0.1s. Local files in `public/clips/` are same-origin
and always take the exact path.

## Adding songs

`src/data/songs.json` is the whole catalogue. One entry per song:

```json
{
  "id": "tamally-maak",
  "title": "تملي معاك",
  "titleLatin": "Tamally Maak",
  "artist": "عمرو دياب",
  "artistLatin": "Amr Diab",
  "year": 2000,
  "difficulty": "easy",
  "clip": "/clips/tamally-maak.mp3",
  "startAt": 45
}
```

`previewUrl` and `artwork` are added by the preview script; `previewUrl` takes
precedence over `clip`, and preview-backed songs use `startAt: 0` because Apple
already excerpts them at a representative moment.

`difficulty` is one of `easy`, `medium`, `hard`, `expert`, `impossible`. The
daily draw takes one song from each tier, so every tier needs at least one entry
— the more you add per tier, the longer before a song repeats.

The Latin fields exist so the guess box matches both `تملي معاك` and
`Tamally Maak`. Search folds alef variants (أ إ آ → ا), ة → ه, ى → ي, and
tashkeel, so players don't have to type exact orthography.

The 25 songs currently in the file are placeholder metadata to make the game
runnable — swap them for the catalogue you actually want.

## Layout

```
src/
├── data/songs.json      catalogue
├── game/
│   ├── stages.ts        clip lengths + points
│   ├── daily.ts         deterministic per-UTC-date selection
│   ├── scoring.ts       round and run scoring
│   ├── search.ts        Arabic-aware matching for the guess box
│   ├── share.ts         emoji result grid
│   └── storage.ts       localStorage stats, degrades to no-op
├── hooks/useAudioClip.ts  Web Audio decode + precise slice playback,
│                        with an <audio> fallback for no-CORS origins
└── components/          player, guess box, stage bar, results

scripts/
├── fetch-previews.mjs       iTunes Search lookup -> previewUrl
└── fetch-previews.test.mjs  unit tests (mocked fetch, no network)
```

Clips are played through the Web Audio API rather than an `<audio>` element:
`currentTime` seeking isn't accurate enough for a 0.1s window, so each file is
decoded once and each stage plays an exact slice of that buffer.

## Stack

React 18 · TypeScript · Vite. No backend, no accounts, no external calls at
runtime.
