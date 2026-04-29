from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq
from dotenv import load_dotenv
import os
import json
import re
import asyncio
import hashlib
import time
from dotenv import load_dotenv
load_dotenv(override=True)  # override=True forces reload

app = FastAPI(title="ToneGuard API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY not found in .env file!")

client = Groq(api_key=GROQ_API_KEY)

# ─────────────────────────────────────────
# Model fallback chain
# If first model fails, try second, then third
# ─────────────────────────────────────────
MODELS = [
    "llama-3.1-8b-instant",        # Primary — fastest
    "llama-3.3-70b-versatile",     # Backup 1 — more powerful
    "meta-llama/llama-4-scout-17b-16e-instruct",  # Backup 2 — latest
]

# ─────────────────────────────────────────
# Simple in-memory cache
# Stores results so same text is never
# analyzed twice — saves API calls
# ─────────────────────────────────────────
cache = {}
CACHE_MAX_SIZE = 500  # max 500 entries in memory

# ─────────────────────────────────────────
# Request queue
# Prevents multiple simultaneous API calls
# Processes one at a time
# ─────────────────────────────────────────
request_semaphore = asyncio.Semaphore(3)  # max 3 simultaneous requests

class AnalyzeRequest(BaseModel):
    text: str
    get_suggestions: bool = False  # False = tone only, True = full suggestions

# ─────────────────────────────────────────
# Rule-based fallback
# Works with zero API calls
# Not as smart but better than nothing
# ─────────────────────────────────────────
def rule_based_fallback(text: str) -> dict:
    return {
        "anger": 0.0,
        "passive_aggressive": 0.0,
        "sarcasm": 0.0,
        "warmth": 0.0,
        "neutral": 0.0,
        "assertive": 0.0,
        "negative_tone_detected": False,
        "rewrite_1": None,
        "rewrite_2": None,
        "rewrite_3": None,
        "rewrite_1_label": None,
        "rewrite_2_label": None,
        "rewrite_3_label": None,
        "used_fallback": True,
        "error_message": "ToneGuard is facing some technical issues — please try again in a moment."
    }

# ─────────────────────────────────────────
# Main tone detection function
# Tries each model in order
# Falls back to rule-based if all fail
# ─────────────────────────────────────────
def detect_tone(text: str, get_suggestions: bool = False) -> dict:

    # Build the prompt based on what we need
    if get_suggestions:
        suggestion_instruction = """
7. Provide exactly 3 alternative rewrites:
   - rewrite_1: Professional and formal tone
   - rewrite_2: Friendly and warm tone
   - rewrite_3: Direct and concise tone
8. Each rewrite should be on its own line with proper sentence breaks
9. Use **word** for bold only for the most important word in each rewrite
10. Use _word_ for italic only for emphasis where truly needed"""

        json_format = """{
  "anger": 0.0,
  "passive_aggressive": 0.0,
  "sarcasm": 0.0,
  "warmth": 0.0,
  "neutral": 0.0,
  "assertive": 0.0,
  "negative_tone_detected": false,
  "rewrite_1": "Professional version here",
  "rewrite_2": "Friendly version here",
  "rewrite_3": "Concise version here",
  "rewrite_1_label": "Professional",
  "rewrite_2_label": "Friendly",
  "rewrite_3_label": "Concise"
}"""
    else:
        # Tone only — no suggestions needed
        # Much cheaper API call
        suggestion_instruction = """
7. Set all rewrite fields to null"""

        json_format = """{
  "anger": 0.0,
  "passive_aggressive": 0.0,
  "sarcasm": 0.0,
  "warmth": 0.0,
  "neutral": 0.0,
  "assertive": 0.0,
  "negative_tone_detected": false,
  "rewrite_1": null,
  "rewrite_2": null,
  "rewrite_3": null,
  "rewrite_1_label": null,
  "rewrite_2_label": null,
  "rewrite_3_label": null
}"""

    prompt = f"""You are a professional communication coach analyzing message tone.

TONE DEFINITIONS:
- anger: Direct frustration, rage, hostility. Example: "This is completely unacceptable!"
- passive_aggressive: Indirect hostility, saying one thing meaning another. Example: "Sure, whatever you think is best"
- sarcasm: Saying opposite of what you mean. Example: "Oh great, another useless meeting"
- warmth: Genuine kindness, gratitude, care. Example: "Thank you so much, I really appreciate you!"
- neutral: Pure information, no emotion. Example: "The meeting is at 3pm tomorrow"
- assertive: Confident, direct, clear. Example: "I will complete this by Friday"

MESSAGE TO ANALYZE:
"{text}"

INSTRUCTIONS:
1. Score each tone from 0.0 to 1.0
2. Scores are independent — do not need to add up to 1.0
3. negative_tone_detected is true if anger, passive_aggressive, or sarcasm > 0.5
4. Each rewrite must be a complete proper sentence with correct punctuation
5. Each rewrite must be a complete rewrite of the ENTIRE message
6. Preserve ALL the points the user made — appreciation, frustration, deadline issue, complaint, meeting info
7. Do NOT summarize — rewrite every part of the message in the new tone
8. Match the approximate length of the original message{suggestion_instruction}

RETURN EXACTLY THIS JSON FORMAT — NO MARKDOWN, NO EXPLANATION:
{json_format}"""

    # Try each model in order
    last_error = None
    for model in MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a tone analyzer. Respond ONLY with valid JSON. No markdown, no code blocks, no explanation."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=600,
                temperature=0.1
            )

            raw = response.choices[0].message.content.strip()
            raw = re.sub(r'```json', '', raw)
            raw = re.sub(r'```', '', raw)
            raw = raw.strip()

            result = json.loads(raw)
            result["used_fallback"] = False
            result["error_message"] = None
            return result

        except Exception as e:
            last_error = e
            print(f"Model {model} failed: {e}")
            time.sleep(0.5)  # small delay before trying next model
            continue

    # All models failed — use rule-based fallback
    print(f"All models failed. Using rule-based fallback. Last error: {last_error}")
    return rule_based_fallback(text)

# ─────────────────────────────────────────
# Cache helper functions
# ─────────────────────────────────────────
def get_cache_key(text: str, get_suggestions: bool) -> str:
    # Create unique key from text + whether suggestions requested
    content = f"{text.strip().lower()}_{get_suggestions}"
    return hashlib.md5(content.encode()).hexdigest()

def get_from_cache(key: str):
    if key in cache:
        entry = cache[key]
        # Cache expires after 1 hour (3600 seconds)
        if time.time() - entry["timestamp"] < 3600:
            return entry["data"]
        else:
            del cache[key]
    return None

def save_to_cache(key: str, data: dict):
    # If cache is full, remove oldest entry
    if len(cache) >= CACHE_MAX_SIZE:
        oldest_key = min(cache.keys(), key=lambda k: cache[k]["timestamp"])
        del cache[oldest_key]
    cache[key] = {
        "data": data,
        "timestamp": time.time()
    }

# ─────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────

@app.get("/")
def root():
    return {
        "name": "ToneGuard API",
        "version": "1.0.0",
        "status": "running",
        "cache_size": len(cache)
    }

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    if not request.text or len(request.text.strip()) < 5:
        raise HTTPException(status_code=400, detail="Text too short")
    if len(request.text) > 2000:
        raise HTTPException(status_code=400, detail="Text too long")

    # Check cache first
    cache_key = get_cache_key(request.text, request.get_suggestions)
    cached = get_from_cache(cache_key)
    if cached:
        print(f"Cache hit! Returning cached result.")
        return cached

    # Use semaphore to limit simultaneous requests
    async with request_semaphore:
        try:
            result = detect_tone(request.text, request.get_suggestions)
            # Save to cache
            save_to_cache(cache_key, result)
            return result
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")