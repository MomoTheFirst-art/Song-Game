# Audio clips

Drop your audio files here. Nothing in this folder is committed — `.gitignore`
excludes everything except this README, so the repo stays free of audio.

## Naming

Each song in `src/data/songs.json` points at a file by its `clip` field:

```json
{ "id": "tamally-maak", "clip": "/clips/tamally-maak.mp3", "startAt": 45 }
```

So `clip: "/clips/tamally-maak.mp3"` means this folder needs `tamally-maak.mp3`.
Any format the browser can decode works — `.mp3`, `.m4a`, `.ogg`, `.wav`.

## `startAt`

`startAt` is how many seconds into the file the clip window begins. Point it at
the hook, not the intro — a 0.1s clip of silence is unguessable. The game reads
forward from there: 0.1s, 0.5s, 2s, 8s, then 15s.

## Missing files

A song whose file is absent shows "ملف الصوت غير موجود" in the player instead of
breaking the round, so you can add the catalogue first and the audio later.

## A note on sourcing

Use audio you have the right to use. Full commercial tracks are licensed, and
serving them publicly is a rights problem even in short clips — fine on your own
machine while building, not fine on a public deployment. If you plan to publish
this, look at licensed previews (Spotify and Apple Music both expose 30-second
preview URLs through their APIs) or music you have cleared.
