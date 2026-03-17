// Audio capture defaults
export const AUDIO_SAMPLE_RATE = 16000;
export const AUDIO_CHANNELS = 1;
export const AUDIO_CHUNK_DURATION_SECS = 30;
export const AUDIO_FORMAT = "wav";

// VAD thresholds
export const VAD_SILENCE_THRESHOLD_MEETING = 5.0; // seconds
export const VAD_SILENCE_THRESHOLD_NOTE = 2.0; // seconds

// Transcription
export const WHISPER_MODEL_CUDA = "large-v3";
export const WHISPER_MODEL_CPU = "small";
export const WHISPER_LANGUAGE = "en";

// Embedding
export const EMBEDDING_DIMENSION = 1536;
export const EMBEDDING_CHUNK_SIZE = 5; // segments per embedding chunk

// Sync
export const SYNC_RETRY_BASE_DELAY_MS = 1000;
export const SYNC_MAX_RETRIES = 5;

// Daemon API
export const DAEMON_API_PORT = 52849;
export const DAEMON_API_HOST = "127.0.0.1";
