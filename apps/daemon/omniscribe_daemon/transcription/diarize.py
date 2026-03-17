"""Speaker diarization using pyannote.audio (optional, Phase 2)."""

import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def diarize_audio(audio_path: Path, num_speakers: int | None = None) -> list[dict]:
    """Run speaker diarization on an audio file.

    Returns list of dicts: [{speaker: str, start: float, end: float}]
    Requires: pip install omniscribe-daemon[diarization]
    Requires: HuggingFace token with pyannote access.
    """
    try:
        from pyannote.audio import Pipeline
    except ImportError:
        logger.warning("pyannote.audio not installed — skipping diarization")
        return []

    import os

    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        logger.warning("HF_TOKEN not set — skipping diarization")
        return []

    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=hf_token,
    )

    diarization = pipeline(
        str(audio_path),
        num_speakers=num_speakers,
    )

    results = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        results.append({
            "speaker": speaker,
            "start": turn.start,
            "end": turn.end,
        })

    logger.info("Diarization complete: %d turns, %d speakers", len(results), len(set(r["speaker"] for r in results)))
    return results
