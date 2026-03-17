"""Local transcription engine using faster-whisper."""

import logging
from dataclasses import dataclass
from pathlib import Path

from omniscribe_daemon.config import settings

logger = logging.getLogger(__name__)

_model = None


@dataclass
class TranscriptionResult:
    text: str
    segments: list[dict]  # [{text, start, end, confidence}]
    language: str
    model_used: str


def _get_device() -> str:
    """Detect best available compute device."""
    if settings.whisper_device != "auto":
        return settings.whisper_device
    try:
        import torch

        if torch.cuda.is_available():
            logger.info("CUDA detected — using GPU acceleration")
            return "cuda"
    except ImportError:
        pass
    logger.info("No CUDA — using CPU")
    return "cpu"


def _load_model():
    """Load the faster-whisper model (lazy singleton)."""
    global _model
    if _model is not None:
        return _model

    from faster_whisper import WhisperModel

    device = _get_device()
    model_name = settings.whisper_model if device == "cuda" else settings.whisper_model_cpu
    compute_type = "float16" if device == "cuda" else "int8"

    logger.info("Loading faster-whisper model=%s device=%s compute=%s", model_name, device, compute_type)
    _model = WhisperModel(model_name, device=device, compute_type=compute_type)
    logger.info("Model loaded successfully")
    return _model


def transcribe_audio(audio_path: Path, language: str | None = None) -> TranscriptionResult:
    """Transcribe a WAV audio file using faster-whisper.

    Args:
        audio_path: Path to WAV file.
        language: Language code (e.g., 'en'). None for auto-detect.

    Returns:
        TranscriptionResult with full text and per-segment details.
    """
    model = _load_model()

    lang = language or settings.whisper_language
    segments_iter, info = model.transcribe(
        str(audio_path),
        language=lang,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
    )

    segments = []
    full_text_parts = []

    for seg in segments_iter:
        segments.append({
            "text": seg.text.strip(),
            "start": seg.start,
            "end": seg.end,
            "confidence": seg.avg_log_prob,
        })
        full_text_parts.append(seg.text.strip())

    device = _get_device()
    model_name = settings.whisper_model if device == "cuda" else settings.whisper_model_cpu

    return TranscriptionResult(
        text=" ".join(full_text_parts),
        segments=segments,
        language=info.language,
        model_used=f"faster-whisper-{model_name}",
    )
