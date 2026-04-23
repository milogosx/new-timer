# Voice Pack

The speech cue transcript inventory for the Elite Recomposition Timer, plus the
render pipeline that turns it into bundled WAV assets.

## Files

- `voice-pack.json` — transcript inventory, one entry per spoken cue.
- `render.py` — reproducible renderer. Profile and speed are pinned here.
- `rendered/` — generated WAV files (gitignored or committed, per policy).

## Pipeline

Transcripts live in this repo. The kokoro-playground toolkit renders them.

```
voice-pack.json  ->  render.py  ->  Kokoro (camilo-kokoro)  ->  rendered/<slug>.wav
```

## Adding or changing a cue

1. Edit `voice-pack.json` (add entry or change the `text` field).
2. If the slug is new, add it to `src/utils/speechCueCatalog.js` and to the
   `speechCueKeys` list in `ios/App/App/EliteTimerRuntimePlugin.swift`.
3. Re-run `render.py` from the kokoro-playground virtualenv.
4. Run `npm run voice-pack:sync` to verify manifest/catalog/swift agree and
   copy the rendered WAVs into `public/audio/` and
   `ios/App/App/public/audio/`. The script exits non-zero on mismatch.

## Current settings

See `render.py`.

- Voice profile: `bright` (`af_bella`)
- Speed: `0.9` (slower than default for coaching clarity)
- Sample rate: 24 kHz mono 16-bit PCM (Kokoro default)
