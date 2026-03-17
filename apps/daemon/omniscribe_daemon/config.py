"""Daemon configuration loaded from environment variables or config file."""

from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Audio capture
    audio_sample_rate: int = 16000
    audio_channels: int = 1
    audio_chunk_duration_secs: int = 30
    audio_format: str = "wav"
    mic_device_name: str | None = None  # Substring match, e.g. "Yeti"

    # VAD
    vad_silence_threshold_meeting: float = 5.0
    vad_silence_threshold_note: float = 2.0

    # Transcription
    whisper_model: str = "large-v3"
    whisper_model_cpu: str = "small"
    whisper_language: str = "en"
    whisper_device: str = "auto"  # "auto", "cuda", "cpu"
    groq_api_key: str | None = None

    # Storage
    data_dir: Path = Path.home() / ".omniscribe"
    sqlite_db_name: str = "omniscribe.db"

    # Supabase
    supabase_url: str | None = None
    supabase_anon_key: str | None = None
    supabase_service_key: str | None = None

    # Embeddings
    openai_api_key: str | None = None
    embedding_model: str = "text-embedding-3-small"
    embedding_chunk_size: int = 5

    # Daemon API
    api_host: str = "127.0.0.1"
    api_port: int = 52849

    # Auto-detection
    auto_detect_enabled: bool = False
    auto_detect_interval_secs: int = 5
    auto_detect_apps: list[str] = ["zoom", "teams", "meet", "slack", "discord"]

    # Device identity
    device_id: str | None = None
    user_id: str | None = None

    model_config = {"env_prefix": "OMNISCRIBE_", "env_file": ".env"}

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.sqlite_db_name

    @property
    def audio_dir(self) -> Path:
        return self.data_dir / "audio"

    def ensure_dirs(self) -> None:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.audio_dir.mkdir(parents=True, exist_ok=True)


settings = Settings()
