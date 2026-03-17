"""Audio capture backends: WASAPI loopback (meetings) and microphone (notes)."""

import logging
import threading
import wave
from pathlib import Path

import numpy as np

from omniscribe_daemon.config import settings

logger = logging.getLogger(__name__)


class AudioCaptureBackend:
    """Base class for audio capture."""

    def __init__(self, output_dir: Path, sample_rate: int = 16000, channels: int = 1):
        self.output_dir = output_dir
        self.sample_rate = sample_rate
        self.channels = channels
        self._is_recording = False
        self._lock = threading.Lock()
        self._chunks: list[np.ndarray] = []

    @property
    def is_recording(self) -> bool:
        return self._is_recording

    def start(self) -> None:
        raise NotImplementedError

    def stop(self) -> list[Path]:
        """Stop recording and return list of chunk file paths."""
        raise NotImplementedError

    def _save_chunk(self, audio_data: np.ndarray, chunk_index: int) -> Path:
        """Save a numpy audio array as a WAV file."""
        chunk_path = self.output_dir / f"chunk_{chunk_index:05d}.wav"
        with wave.open(str(chunk_path), "wb") as wf:
            wf.setnchannels(self.channels)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(self.sample_rate)
            # Convert float32 [-1, 1] to int16
            audio_int16 = (audio_data * 32767).astype(np.int16)
            wf.writeframes(audio_int16.tobytes())
        return chunk_path


class WASAPILoopbackCapture(AudioCaptureBackend):
    """Capture system audio via WASAPI loopback (Windows).

    Used for meeting recording — captures what you hear through speakers/headphones.
    """

    def __init__(self, output_dir: Path, sample_rate: int = 16000, channels: int = 1):
        super().__init__(output_dir, sample_rate, channels)
        self._stream = None
        self._thread: threading.Thread | None = None
        self._chunk_paths: list[Path] = []

    def start(self) -> None:
        import pyaudiowpatch as pyaudio

        self._is_recording = True
        self._chunk_paths = []

        p = pyaudio.PyAudio()

        # Find the default WASAPI loopback device
        wasapi_info = None
        for host_api_index in range(p.get_host_api_count()):
            host_api = p.get_host_api_info_by_index(host_api_index)
            if host_api["name"] == "Windows WASAPI":
                wasapi_info = host_api
                break

        if wasapi_info is None:
            p.terminate()
            raise RuntimeError("Windows WASAPI host API not found")

        # Get default loopback device
        default_speakers = p.get_device_info_by_index(wasapi_info["defaultOutputDevice"])
        if not default_speakers.get("isLoopbackDevice", False):
            # Find the loopback variant
            for i in range(p.get_device_count()):
                dev = p.get_device_info_by_index(i)
                if dev.get("isLoopbackDevice") and dev["name"].startswith(
                    default_speakers["name"]
                ):
                    default_speakers = dev
                    break

        device_sample_rate = int(default_speakers["defaultSampleRate"])
        device_channels = default_speakers["maxInputChannels"]

        logger.info(
            "WASAPI loopback device: %s (rate=%d, ch=%d)",
            default_speakers["name"],
            device_sample_rate,
            device_channels,
        )

        # Pre-create resampler if needed
        loopback_resampler = None
        if device_sample_rate != self.sample_rate:
            import torchaudio
            loopback_resampler = torchaudio.transforms.Resample(
                device_sample_rate, self.sample_rate
            )

        chunk_samples = self.sample_rate * settings.audio_chunk_duration_secs
        self._buffer: list[np.ndarray] = []
        self._buffer_samples = 0
        self._chunk_index = 0

        def audio_callback(in_data, frame_count, time_info, status):
            if not self._is_recording:
                return (None, pyaudio.paComplete)

            # Convert raw bytes to numpy float32
            audio = np.frombuffer(in_data, dtype=np.float32).copy()

            # Downmix to mono if stereo
            if device_channels > 1:
                audio = audio.reshape(-1, device_channels).mean(axis=1)

            # Resample if device rate differs from target
            if loopback_resampler is not None:
                import torch as _torch

                audio_tensor = _torch.from_numpy(audio).unsqueeze(0)
                audio = loopback_resampler(audio_tensor).squeeze(0).numpy()

            self._buffer.append(audio)
            self._buffer_samples += len(audio)

            # Flush chunk when we have enough
            if self._buffer_samples >= chunk_samples:
                combined = np.concatenate(self._buffer)[:chunk_samples]
                path = self._save_chunk(combined, self._chunk_index)
                self._chunk_paths.append(path)
                self._chunk_index += 1
                remainder = np.concatenate(self._buffer)[chunk_samples:]
                self._buffer = [remainder] if len(remainder) > 0 else []
                self._buffer_samples = len(remainder)

            return (None, pyaudio.paContinue)

        self._stream = p.open(
            format=pyaudio.paFloat32,
            channels=device_channels,
            rate=device_sample_rate,
            input=True,
            input_device_index=default_speakers["index"],
            frames_per_buffer=1024,
            stream_callback=audio_callback,
        )
        self._stream.start_stream()
        logger.info("WASAPI loopback capture started")

    def stop(self) -> list[Path]:
        self._is_recording = False
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
            self._stream = None

        # Flush remaining buffered audio as a final chunk
        if self._buffer and self._buffer_samples > 0:
            combined = np.concatenate(self._buffer)
            if len(combined) > 0:
                path = self._save_chunk(combined, self._chunk_index)
                self._chunk_paths.append(path)
                logger.info("Flushed final chunk: %d samples", len(combined))

        logger.info("WASAPI loopback capture stopped, %d chunks saved", len(self._chunk_paths))
        return self._chunk_paths


class MicrophoneCapture(AudioCaptureBackend):
    """Capture microphone input (used for voice notes/dictation)."""

    def __init__(self, output_dir: Path, sample_rate: int = 16000, channels: int = 1):
        super().__init__(output_dir, sample_rate, channels)
        self._stream = None
        self._chunk_paths: list[Path] = []

    def start(self) -> None:
        import pyaudiowpatch as pyaudio

        self._is_recording = True
        self._chunk_paths = []

        p = pyaudio.PyAudio()

        # Find mic by name if configured, otherwise use default
        mic_name = settings.mic_device_name
        default_mic = None
        if mic_name:
            for i in range(p.get_device_count()):
                dev = p.get_device_info_by_index(i)
                if (dev["maxInputChannels"] > 0
                    and not dev.get("isLoopbackDevice")
                    and mic_name.lower() in dev["name"].lower()
                    and dev.get("hostApi") is not None):
                    # Prefer WASAPI devices (higher hostApi index on Windows)
                    if default_mic is None or dev["index"] > default_mic["index"]:
                        default_mic = dev
            if default_mic:
                logger.info("Found configured mic '%s': %s", mic_name, default_mic["name"])
            else:
                logger.warning("Mic '%s' not found, falling back to default", mic_name)

        if default_mic is None:
            default_mic = p.get_default_input_device_info()

        device_sample_rate = int(default_mic["defaultSampleRate"])
        device_channels = min(default_mic["maxInputChannels"], 1)

        logger.info(
            "Microphone device: %s (rate=%d)",
            default_mic["name"],
            device_sample_rate,
        )

        # Pre-create resampler if needed (avoid recreating per callback)
        mic_resampler = None
        if device_sample_rate != self.sample_rate:
            import torchaudio
            mic_resampler = torchaudio.transforms.Resample(
                device_sample_rate, self.sample_rate
            )

        chunk_samples = self.sample_rate * settings.audio_chunk_duration_secs
        self._buffer: list[np.ndarray] = []
        self._buffer_samples = 0
        self._chunk_index = 0

        def audio_callback(in_data, frame_count, time_info, status):
            if not self._is_recording:
                return (None, pyaudio.paComplete)

            audio = np.frombuffer(in_data, dtype=np.float32).copy()

            if mic_resampler is not None:
                import torch as _torch

                audio_tensor = _torch.from_numpy(audio).unsqueeze(0)
                audio = mic_resampler(audio_tensor).squeeze(0).numpy()

            self._buffer.append(audio)
            self._buffer_samples += len(audio)

            if self._buffer_samples >= chunk_samples:
                combined = np.concatenate(self._buffer)[:chunk_samples]
                path = self._save_chunk(combined, self._chunk_index)
                self._chunk_paths.append(path)
                self._chunk_index += 1
                remainder = np.concatenate(self._buffer)[chunk_samples:]
                self._buffer = [remainder] if len(remainder) > 0 else []
                self._buffer_samples = len(remainder)

            return (None, pyaudio.paContinue)

        self._stream = p.open(
            format=pyaudio.paFloat32,
            channels=device_channels or 1,
            rate=device_sample_rate,
            input=True,
            input_device_index=default_mic["index"],
            frames_per_buffer=1024,
            stream_callback=audio_callback,
        )
        self._stream.start_stream()
        logger.info("Microphone capture started")

    def stop(self) -> list[Path]:
        self._is_recording = False
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
            self._stream = None

        # Flush remaining buffered audio as a final chunk
        if self._buffer and self._buffer_samples > 0:
            combined = np.concatenate(self._buffer)
            if len(combined) > 0:
                path = self._save_chunk(combined, self._chunk_index)
                self._chunk_paths.append(path)
                logger.info("Flushed final chunk: %d samples", len(combined))

        logger.info("Microphone capture stopped, %d chunks saved", len(self._chunk_paths))
        return self._chunk_paths


def get_capture_backend(session_type: str, output_dir: Path) -> AudioCaptureBackend:
    """Factory: returns the right capture backend based on session type."""
    output_dir.mkdir(parents=True, exist_ok=True)
    if session_type == "meeting":
        return WASAPILoopbackCapture(output_dir, settings.audio_sample_rate, settings.audio_channels)
    else:
        return MicrophoneCapture(output_dir, settings.audio_sample_rate, settings.audio_channels)
