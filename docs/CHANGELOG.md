# Changelog

## 2026-03-17

- Initial monorepo scaffold (pnpm workspaces + Turborepo)
- Shared TypeScript types package (`packages/shared/`)
- Supabase migrations: sessions, segments, pgvector embeddings, RLS policies
- Python daemon with full audio capture + transcription pipeline (`apps/daemon/`)
  - WASAPI loopback capture (meetings) + microphone capture (notes)
  - Silero VAD for speech detection
  - faster-whisper transcription engine with CUDA/CPU support
  - Groq API fallback for non-GPU devices
  - SQLite local storage with sync queue
  - Supabase background sync engine
  - Session manager orchestrating capture → transcribe → store lifecycle
  - FastAPI local server for tray app communication
- CLAUDE.md project documentation
