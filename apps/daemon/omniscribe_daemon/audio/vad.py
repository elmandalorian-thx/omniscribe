"""Voice Activity Detection using Silero VAD."""

import logging

import numpy as np
import torch

logger = logging.getLogger(__name__)

_model = None
_utils = None


def _load_model():
    global _model, _utils
    if _model is None:
        _model, _utils = torch.hub.load(
            repo_or_dir="snakers4/silero-vad",
            model="silero_vad",
            trust_repo=True,
        )
        logger.info("Silero VAD model loaded")
    return _model, _utils


def detect_speech_segments(
    audio: np.ndarray,
    sample_rate: int = 16000,
    threshold: float = 0.5,
    min_speech_duration_ms: int = 250,
    min_silence_duration_ms: int = 2000,
) -> list[dict]:
    """Detect speech segments in an audio array.

    Returns list of dicts with 'start' and 'end' keys (in seconds).
    """
    model, utils = _load_model()
    get_speech_timestamps = utils[0]

    audio_tensor = torch.from_numpy(audio).float()
    if audio_tensor.dim() > 1:
        audio_tensor = audio_tensor.mean(dim=-1)

    speech_timestamps = get_speech_timestamps(
        audio_tensor,
        model,
        sampling_rate=sample_rate,
        threshold=threshold,
        min_speech_duration_ms=min_speech_duration_ms,
        min_silence_duration_ms=min_silence_duration_ms,
    )

    segments = []
    for ts in speech_timestamps:
        segments.append({
            "start": ts["start"] / sample_rate,
            "end": ts["end"] / sample_rate,
        })

    return segments


def has_speech(audio: np.ndarray, sample_rate: int = 16000, threshold: float = 0.5) -> bool:
    """Quick check: does this audio chunk contain speech?"""
    segments = detect_speech_segments(audio, sample_rate, threshold)
    return len(segments) > 0
