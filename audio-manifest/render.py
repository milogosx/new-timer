"""Render the Elite Recomposition Timer voice pack from voice-pack.json.

Voice profile and speed are pinned here so the pack is reproducible. If you
change the profile or speed, update this file (not the manifest) so transcript
and synthesis settings stay cleanly separated.

Prereqs:
    cd /Users/camiloperezsetright/Projects/kokoro-playground
    source .venv/bin/activate

Run:
    python /Users/camiloperezsetright/Projects/new-timer/audio-manifest/render.py

Output lands in audio-manifest/rendered/ as <slug>.wav.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import soundfile as sf
from numpy import concatenate

from camilo_kokoro.synth import KokoroSpeechEngine
from camilo_kokoro.config import VOICE_PROFILES


PROFILE_NAME = "warm"
SPEED = 1.10

MANIFEST_PATH = Path(__file__).parent / "voice-pack.json"
OUTPUT_DIR = Path(__file__).parent / "rendered"


def main() -> int:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    items = [entry for entry in manifest.get("items", []) if isinstance(entry, dict)]
    if not items:
        print("Manifest contains no items.", file=sys.stderr)
        return 1

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    profile = VOICE_PROFILES[PROFILE_NAME]
    engine = KokoroSpeechEngine(profile=profile)
    pipeline = engine.get_pipeline(profile.lang_code)

    total = len(items)
    skipped: list[str] = []
    for index, item in enumerate(items, start=1):
        slug = item["slug"]
        text = item["text"]
        apply_pronunciation = bool(item.get("apply_pronunciation", True))
        spoken = (
            engine.apply_pronunciation_rules(text, profile.pronunciation_rules)
            if apply_pronunciation
            else text
        )

        audio_parts = []
        for result in pipeline(spoken, voice=profile.voice, speed=SPEED):
            if result.audio is not None:
                audio_parts.append(result.audio)

        if not audio_parts:
            print(f"[{index}/{total}] {slug}: no audio produced", file=sys.stderr)
            skipped.append(slug)
            continue

        audio = audio_parts[0] if len(audio_parts) == 1 else concatenate(audio_parts)
        sf.write(OUTPUT_DIR / f"{slug}.wav", audio, profile.sample_rate)
        print(f"[{index}/{total}] {slug}")

    print(f"Rendered {total - len(skipped)}/{total} cues as {PROFILE_NAME} @ speed {SPEED}")
    if skipped:
        print(f"Skipped (no audio): {', '.join(skipped)}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
