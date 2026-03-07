import os
import subprocess

OUT_DIR = "public/audio/samples"

# List of Female Neural Voices available in Edge TTS
VOICES = [
    "en-GB-LibbyNeural",
    "en-GB-MaisieNeural",
    "en-GB-SoniaNeural",
    "en-IE-EmilyNeural",
    "en-AU-NatashaNeural",
    "en-NZ-MollyNeural",
    "en-CA-ClaraNeural",
    "en-US-AriaNeural",
    "en-US-JennyNeural"
]

TEST_PHRASE = "Starting warm up. Let's lock in king. This is how you build."

os.makedirs(OUT_DIR, exist_ok=True)

for voice in VOICES:
    # Generate the base voice
    out_path_base = os.path.join(OUT_DIR, f"{voice}.mp3")
    print(f"Generating {voice}...")
    subprocess.run([
        "edge-tts", 
        "--voice", voice, 
        "--text", TEST_PHRASE, 
        "--write-media", out_path_base
    ], check=True)

print("All voice samples generated successfully in public/audio/samples/")
