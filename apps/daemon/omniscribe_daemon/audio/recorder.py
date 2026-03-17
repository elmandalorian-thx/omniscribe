"""Audio chunk writer and ring buffer management."""

import logging
import wave
from pathlib import Path

import numpy as np

logger = logging.getLogger(__name__)


class ChunkWriter:
    """Writes audio data into fixed-duration WAV chunks."""

    def __init__(
        self,
        output_dir: Path,
        chunk_duration_secs: int = 30,
        sample_rate: int = 16000,
        channels: int = 1,
    ):
        self.output_dir = output_dir
        self.chunk_duration_secs = chunk_duration_secs
        self.sample_rate = sample_rate
        self.channels = channels
        self.chunk_samples = sample_rate * chunk_duration_secs
        self._buffer = np.array([], dtype=np.float32)
        self._chunk_index = 0
        self._chunk_paths: list[Path] = []

    def feed(self, audio: np.ndarray) -> list[Path]:
        """Feed audio data. Returns paths of any completed chunks."""
        self._buffer = np.concatenate([self._buffer, audio])
        new_chunks = []

        while len(self._buffer) >= self.chunk_samples:
            chunk_data = self._buffer[: self.chunk_samples]
            self._buffer = self._buffer[self.chunk_samples :]

            path = self._save_chunk(chunk_data)
            new_chunks.append(path)
            self._chunk_paths.append(path)

        return new_chunks

    def flush(self) -> Path | None:
        """Save any remaining audio as a final partial chunk."""
        if len(self._buffer) == 0:
            return None

        path = self._save_chunk(self._buffer)
        self._chunk_paths.append(path)
        self._buffer = np.array([], dtype=np.float32)
        return path

    def _save_chunk(self, audio_data: np.ndarray) -> Path:
        chunk_path = self.output_dir / f"chunk_{self._chunk_index:05d}.wav"
        audio_int16 = (audio_data * 32767).clip(-32768, 32767).astype(np.int16)

        with wave.open(str(chunk_path), "wb") as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(audio_int16.tobytes())

        self._chunk_index += 1
        logger.debug("Saved chunk %s (%d samples)", chunk_path.name, len(audio_data))
        return chunk_path

    @property
    def all_chunks(self) -> list[Path]:
        return list(self._chunk_paths)
