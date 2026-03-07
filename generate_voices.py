import os
import subprocess

VOICE = "en-US-AriaNeural"
OUT_DIR = "public/audio"

# Expanded list of varied, motivational phrases
PROMPTS = {
    "start_warmup": "Welcome back. Let's get this warm up started. Set your intentions, and let's build.",
    "warmup_complete": "Warm up complete. Time to lock in for the main event.",
    "quarter_way": "Great pace. You're a quarter of the way through, keep that energy up.",
    "halfway": "Halfway there. This is where the real work begins. Don't drop your standards now.",
    "three_quarters": "Three quarters done. Home stretch. Push through the burn, you've got this.",
    "five_minutes": "Only five minutes remaining. Empty the tank.",
    "one_minute": "Final minute. Give it absolutely everything you have left.",
    "workout_complete": "Workout complete. Incredible work today. Rest up, and come back stronger."
}

os.makedirs(OUT_DIR, exist_ok=True)

for key, text in PROMPTS.items():
    out_path = os.path.join(OUT_DIR, f"{key}.mp3")
    cmd = [
        "edge-tts", 
        "--voice", VOICE, 
        "--text", text, 
        "--write-media", out_path
    ]
    
    subprocess.run(cmd, check=True)

print("All audio files generated successfully.")
