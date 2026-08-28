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

Then add audio — the game ships with catalogue metadata but no audio files. See
[`public/clips/README.md`](public/clips/README.md) for the naming rules and a
note on sourcing clips you have the right to use.

```bash
npm run build      # production build to dist/
npm run typecheck  # tsc, no emit
```

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
├── hooks/useAudioClip.ts  Web Audio decode + precise slice playback
└── components/          player, guess box, stage bar, results
```

Clips are played through the Web Audio API rather than an `<audio>` element:
`currentTime` seeking isn't accurate enough for a 0.1s window, so each file is
decoded once and each stage plays an exact slice of that buffer.

## Stack

React 18 · TypeScript · Vite. No backend, no accounts, no external calls at
runtime.
