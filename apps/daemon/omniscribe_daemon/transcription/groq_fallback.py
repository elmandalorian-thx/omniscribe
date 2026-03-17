"""Groq Whisper API fallback for devices without local GPU."""

import logging
from dataclasses import dataclass
from pathlib import Path

from omniscribe_daemon.config import settings

logger = logging.getLogger(__name__)


@dataclass
class GroqTranscriptionResult:
    text: str
    segments: list[dict]
    language: str
    model_used: str


async def transcribe_with_groq(audio_path: Path, language: str = "en") -> GroqTranscriptionResult:
    """Transcribe audio using Groq's Whisper API.

    Costs ~$0.02/hr of audio. Requires OMNISCRIBE_GROQ_API_KEY.
    """
    if not settings.groq_api_key:
        raise RuntimeError("Groq API key not configured (set OMNISCRIBE_GROQ_API_KEY)")

    import httpx

    async with httpx.AsyncClient(timeout=120.0) as client:
        with open(audio_path, "rb") as f:
            response = await client.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                files={"file": (audio_path.name, f, "audio/wav")},
                data={
                    "model": "whisper-large-v3",
                    "language": language,
                    "response_format": "verbose_json",
                    "timestamp_granularities[]": "segment",
                },
            )
            response.raise_for_status()
            data = response.json()

    segments = []
    for seg in data.get("segments", []):
        segments.append({
            "text": seg.get("text", "").strip(),
            "start": seg.get("start", 0.0),
            "end": seg.get("end", 0.0),
            "confidence": seg.get("avg_logprob", 0.0),
        })

    return GroqTranscriptionResult(
        text=data.get("text", ""),
        segments=segments,
        language=data.get("language", language),
        model_used="groq-whisper-large-v3",
    )
